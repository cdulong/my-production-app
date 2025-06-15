# app.py

print("DEBUG: This app.py file is being loaded! Version: [2025-06-10 9:21 AM]")

from flask import Flask, request, jsonify, render_template
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from config import Config
from datetime import date, timedelta
from sqlalchemy import func, extract
import calendar # For getting day names

import smtplib
import base64
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
from email.utils import formataddr
import os # For environment variables
from dotenv import load_dotenv
load_dotenv()

app = Flask(__name__)
app.config.from_object(Config)
db = SQLAlchemy(app)
migrate = Migrate(app, db) # Initialize Flask-Migrate

# --- SMTP Configuration from Environment Variables ---
SMTP_SERVER = os.environ.get('SMTP_SERVER') # e.g., 'smtp.gmail.com' for Gmail
SMTP_PORT = int(os.environ.get('SMTP_PORT')) # e.g., 587 for TLS, 465 for SSL
SMTP_USERNAME = os.environ.get('SMTP_USERNAME') # Your sending email address
SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD') # Your email password or app-specific password
SENDER_EMAIL = os.environ.get('SENDER_EMAIL') # The email address that appears as the sender
SENDER_NAME = os.environ.get('SENDER_NAME') # The name that appears as the sender
# --- END NEW ---


# --- Helper Functions ---
# Helper to get the Sunday (00:00:00) of the week for any given date object
def get_sunday_of_week(any_date):
    """Returns the Sunday of the week for the given date."""
    # weekday() returns 0 for Monday, 6 for Sunday.
    # To normalize: days_to_subtract = (any_date.weekday() + 1) % 7
    days_to_subtract = (any_date.weekday() + 1) % 7
    return any_date - timedelta(days=days_to_subtract)

# Helper to get the Monday (00:00:00) of the week for any given date object
# This version explicitly handles Sunday first to avoid the backward snap observed.
def get_monday_of_week(d):
    """
    Returns the Monday (00:00:00) of the calendar week for any given date object.
    If the input date is a Sunday, it returns the Monday of the *same* calendar week.
    """
    # Create a new Date object directly from its year, month, and day components
    # to ensure it's interpreted consistently in the local timezone's midnight.
    date_obj = date(d.year, d.month, d.day) # Use date object for simplicity, no time component needed

    day = date_obj.weekday() # Get the day of the week (0 for Monday, ..., 6 for Sunday)

    # If the date is Sunday (Python's weekday 6), we want to advance it to Monday (day 0) first.
    # This ensures it's treated as part of the *upcoming* Monday-starting week.
    if day == 6: # Sunday
        date_obj += timedelta(days=1)
        day = date_obj.weekday() # Recalculate day, which will now be 0 (Monday)

    # Now, 'date_obj' is guaranteed to be a Monday through Saturday (Python's weekday 0-5).
    # Calculate days to subtract to go back to the Monday of *this* week (0-based index)
    # Example: if it's Tuesday (weekday 1), days_to_subtract = 1.
    # Example: if Monday (weekday 0), days_to_subtract = 0.
    days_to_subtract = day

    monday_of_week = date_obj - timedelta(days=days_to_subtract)
    
    return monday_of_week

# Helper function to calculate Dollars Per Hour
def calculate_dollars_per_hour(value, hours):
    if hours is None or float(hours) == 0:
        return None # Avoid division by zero, return None if hours are zero or not set
    if value is None:
        return None # If value is not set, DPH cannot be calculated
    
    try:
        return round(float(value) / float(hours), 2)
    except (ValueError, TypeError): # Handle cases where conversion to float fails
        return None


# --- Database Models ---
class WorkArea(db.Model):
    __tablename__ = 'work_areas'
    work_area_id = db.Column(db.Integer, primary_key=True)
    work_area_name = db.Column(db.String(100), unique=True, nullable=False)
    reporting_week_start_offset_days = db.Column(db.Integer, nullable=False)
    contributing_duration_days = db.Column(db.Integer, default=7, nullable=False)
    display_order = db.Column(db.Integer, nullable=True) # Used for custom sorting

    employees = db.relationship('Employee', backref='primary_work_area', lazy=True)
    daily_hours_entries = db.relationship('DailyEmployeeHours', backref='work_area', lazy=True)

    def __repr__(self):
        return f"<WorkArea {self.work_area_name}>"

    def to_dict(self):
        return {
            'work_area_id': self.work_area_id,
            'work_area_name': self.work_area_name,
            'reporting_week_start_offset_days': self.reporting_week_start_offset_days,
            'contributing_duration_days': self.contributing_duration_days,
            'display_order': self.display_order
        }

class Employee(db.Model):
    __tablename__ = 'employees'
    employee_id = db.Column(db.Integer, primary_key=True)
    first_name = db.Column(db.String(50), nullable=False)
    last_initial = db.Column(db.String(5), nullable=False)
    # --- REMOVED: position (string) ---
    # position = db.Column(db.String(50), nullable=False) 
    # --- ADDED: position_id (ForeignKey) ---
    position_id = db.Column(db.Integer, db.ForeignKey('positions.position_id'), nullable=False)
    # --- END MODIFIED ---
    primary_work_area_id = db.Column(db.Integer, db.ForeignKey('work_areas.work_area_id'), nullable=False)
    display_order = db.Column(db.Integer, nullable=False, server_default='999999') # Used for custom sorting

    employment_start_date = db.Column(db.Date, nullable=False)
    employment_end_date = db.Column(db.Date, nullable=True)

    daily_hours_entries = db.relationship('DailyEmployeeHours', backref='employee', lazy=True)

    def __repr__(self):
        return f"<Employee {self.first_name} {self.last_initial}>"

    def to_dict(self):
        # Determine default_forecasted_daily_hours based on position
        # forecasted_hours = 0
        # if self.position == "Regular Staff":
        #    forecasted_hours = 7.5
        # elif self.position == "Team Leader":
        #    forecasted_hours = 7.75
        # elif self.position == "Supervisor": # --- NEW: Supervisor hours ---
        #    forecasted_hours = 8.0
        # --- END NEW ---

        return {
            'employee_id': self.employee_id,
            'first_name': self.first_name,
            'last_initial': self.last_initial,
            'position_id': self.position_id, # Include ID for frontend
            'position_title': self.position_obj.title if self.position_obj else None, # Get title from relationship
            'primary_work_area_id': self.primary_work_area_id,
            'primary_work_area_name': self.primary_work_area.work_area_name if self.primary_work_area else None,
            'default_forecasted_daily_hours': str(self.position_obj.default_hours) if self.position_obj else None, # Get hours from relationship
            'display_order': self.display_order,
            'employment_start_date': self.employment_start_date.isoformat(),
            'employment_end_date': self.employment_end_date.isoformat() if self.employment_end_date else None
        }

class OverallProductionWeek(db.Model):
    __tablename__ = 'overall_production_weeks'
    overall_production_week_id = db.Column(db.Integer, primary_key=True)
    reporting_week_start_date = db.Column(db.Date, nullable=False, unique=True)
    reporting_week_end_date = db.Column(db.Date, nullable=False)

    forecasted_product_value = db.Column(db.Numeric(12, 2), nullable=True)
    actual_product_value = db.Column(db.Numeric(12, 2), nullable=True)

    forecasted_dollars_per_hour = db.Column(db.Numeric(10, 2), nullable=True)
    actual_dollars_per_hour = db.Column(db.Numeric(10, 2), nullable=True)

    forecasted_boxes_built = db.Column(db.Integer, nullable=True)
    actual_boxes_built = db.Column(db.Integer, nullable=True)
    forecasted_total_production_hours = db.Column(db.Numeric(10, 2), nullable=True)
    actual_total_production_hours = db.Column(db.Numeric(10, 2), nullable=True)

    daily_hours = db.relationship('DailyEmployeeHours', backref='production_week', lazy=True, cascade="all, delete-orphan")

    def __repr__(self):
        return f"<OverallProductionWeek {self.reporting_week_start_date}>"

    def to_dict(self):
        return {
            'overall_production_week_id': self.overall_production_week_id,
            'reporting_week_start_date': self.reporting_week_start_date.isoformat(),
            'reporting_week_end_date': self.reporting_week_end_date.isoformat(),
            
            'forecasted_product_value': str(self.forecasted_product_value) if self.forecasted_product_value is not None else None,
            'actual_product_value': str(self.actual_product_value) if self.actual_product_value is not None else None,

            'forecasted_dollars_per_hour': str(self.forecasted_dollars_per_hour) if self.forecasted_dollars_per_hour is not None else None,
            'actual_dollars_per_hour': str(self.actual_dollars_per_hour) if self.actual_dollars_per_hour is not None else None,
            
            'forecasted_boxes_built': self.forecasted_boxes_built,
            'actual_boxes_built': self.actual_boxes_built,
            'forecasted_total_production_hours': str(self.forecasted_total_production_hours) if self.forecasted_total_production_hours is not None else None,
            'actual_total_production_hours': str(self.actual_total_production_hours) if self.actual_total_production_hours is not None else None,
        }

class DailyEmployeeHours(db.Model):
    __tablename__ = 'daily_employee_hours'
    daily_hour_id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.employee_id'), nullable=False)
    work_area_id = db.Column(db.Integer, db.ForeignKey('work_areas.work_area_id'), nullable=False)
    work_date = db.Column(db.Date, nullable=False)
    forecasted_hours = db.Column(db.Numeric(4, 2), nullable=False)
    actual_hours = db.Column(db.Numeric(4, 2), nullable=True)
    overall_production_week_id = db.Column(db.Integer, db.ForeignKey('overall_production_weeks.overall_production_week_id'), nullable=False)

    __table_args__ = (db.UniqueConstraint('employee_id', 'work_area_id', 'work_date', 'overall_production_week_id', name='_employee_area_date_week_uc'),)

    def __repr__(self):
        return f"<DailyHours Employee:{self.employee_id} Date:{self.work_date} Hours:{self.actual_hours}>"

    def to_dict(self):
        return {
            'daily_hour_id': self.daily_hour_id,
            'employee_id': self.employee_id,
            'work_area_id': self.work_area_id,
            'work_date': self.work_date.isoformat(),
            'forecasted_hours': str(self.forecasted_hours),
            'actual_hours': str(self.actual_hours) if self.actual_hours is not None else None,
            'overall_production_week_id': self.overall_production_week_id
        }

class Position(db.Model):
    __tablename__ = 'positions'
    position_id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(50), unique=True, nullable=False)
    default_hours = db.Column(db.Numeric(4, 2), nullable=False) # Store default hours here
    display_order = db.Column(db.Integer, nullable=False, server_default='999999') # Default to a large number

    # Relationship to employees (one Position can have many Employees)
    employees = db.relationship('Employee', backref='position_obj', lazy=True)

    def __repr__(self):
        return f"<Position {self.title} ({self.default_hours} hrs)>"

    def to_dict(self):
        return {
            'position_id': self.position_id,
            'title': self.title,
            'default_hours': str(self.default_hours),
            'display_order': self.display_order # --- NEW: Include in to_dict ---
        }

# --- Frontend Serving Routes ---
@app.route('/')
def index():
    today = date.today()

    this_months_hours = db.session.query(
        db.func.sum(DailyEmployeeHours.actual_hours)
    ).filter(
        extract('month', DailyEmployeeHours.work_date) == today.month,
        extract('year', DailyEmployeeHours.work_date) == today.year
    ).scalar() or 0

    total_employees = Employee.query.filter(Employee.employment_end_date == None).count()
    total_work_areas = WorkArea.query.count()
    total_positions = Position.query.count()

    return render_template('index.html',
                           total_employees=total_employees,
                           total_work_areas=total_work_areas,
                           total_positions=total_positions,
                           this_months_hours=this_months_hours)

@app.route('/work_areas')
def work_areas_page():
    return render_template('work_areas.html')

@app.route('/employees')
def employees_page():
    return render_template('employees.html')

@app.route('/positions')
def positions_page():
    return render_template('positions.html')

@app.route('/production_weeks')
def production_weeks_page():
    return render_template('production_weeks.html')

@app.route('/daily-hours-entry')
def daily_hours_entry_page():
    return render_template('daily_hours_entry.html')

@app.route('/reports')
def reports_page():
    return render_template('reports.html')

@app.route('/monthly-work-area-hours-report')
def monthly_work_area_hours_report_page():
    return render_template('monthly_work_area_hours_report.html')


# --- API Endpoints ---

# Work Areas API
@app.route('/api/work-areas', methods=['GET'])
def get_work_areas():
    # Order by display_order, then by work_area_id as a fallback
    work_areas = WorkArea.query.order_by(WorkArea.display_order, WorkArea.work_area_id).all()
    return jsonify([wa.to_dict() for wa in work_areas])

@app.route('/api/work-areas', methods=['POST'])
def create_work_area():
    data = request.get_json()
    if not data or not 'work_area_name' in data or not 'reporting_week_start_offset_days' in data:
        return jsonify({'message': 'Missing required data'}), 400

    new_work_area = WorkArea(
        work_area_name=data['work_area_name'],
        reporting_week_start_offset_days=data['reporting_week_start_offset_days'],
        contributing_duration_days=data.get('contributing_duration_days', 7)
    )
    db.session.add(new_work_area)
    db.session.commit()
    return jsonify(new_work_area.to_dict()), 201

@app.route('/api/work-areas/<int:id>', methods=['PUT'])
def update_work_area(id):
    work_area = WorkArea.query.get_or_404(id)
    data = request.get_json()
    if not data:
        return jsonify({'message': 'No data provided for update'}), 400

    work_area.work_area_name = data.get('work_area_name', work_area.work_area_name)
    work_area.reporting_week_start_offset_days = data.get('reporting_week_start_offset_days', work_area.reporting_week_start_offset_days)
    work_area.contributing_duration_days = data.get('contributing_duration_days', work_area.contributing_duration_days)

    db.session.commit()
    return jsonify(work_area.to_dict())

@app.route('/api/work-areas/<int:id>', methods=['DELETE'])
def delete_work_area(id):
    work_area = WorkArea.query.get_or_404(id)

    if Employee.query.filter_by(primary_work_area_id=id).count() > 0:
        return jsonify({'message': 'Cannot delete work area with associated employees. Reassign employees first.'}), 409

    if DailyEmployeeHours.query.filter_by(work_area_id=id).count() > 0:
        return jsonify({'message': 'Cannot delete work area with associated daily hours entries. Delete related daily hours first.'}), 409

    db.session.delete(work_area)
    db.session.commit()
    return jsonify({'message': 'Work Area deleted successfully'}), 204

@app.route('/api/work-areas/reorder', methods=['PUT'])
def reorder_work_areas():
    data = request.get_json() # Expected: [{"work_area_id": 1, "order": 0}, {"work_area_id": 2, "order": 1}, ...]
    if not isinstance(data, list):
        return jsonify({'message': 'Expected a list of work area order objects'}), 400

    try:
        for item in data:
            wa_id = item.get('work_area_id')
            new_order = item.get('order')
            if wa_id is None or new_order is None:
                return jsonify({'message': 'Missing work_area_id or order in one or more items'}), 400
            
            work_area = WorkArea.query.get(wa_id)
            if work_area:
                work_area.display_order = new_order
            else:
                print(f"Warning: Work Area with ID {wa_id} not found for reordering. Skipping.")
        
        db.session.commit()
        return jsonify({'message': 'Work Area order updated successfully'}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error reordering work areas: {e}")
        return jsonify({'message': 'An error occurred during reordering.', 'details': str(e)}), 500

@app.route('/api/positions', methods=['GET'])
def get_positions():
    """Returns a list of all available positions."""
    positions = Position.query.order_by(Position.display_order, Position.position_id).all()
    return jsonify([p.to_dict() for p in positions])

# Employees API
@app.route('/api/employees', methods=['GET'])
def get_employees():
    # Order by display_order, then by employee_id as a fallback
    employees = Employee.query.order_by(Employee.display_order, Employee.employee_id).all()
    return jsonify([emp.to_dict() for emp in employees])

@app.route('/api/positions', methods=['POST'])
def create_position():
    """Creates a new position."""
    data = request.get_json()
    if not data or not 'title' in data or not 'default_hours' in data:
        return jsonify({'message': 'Missing title or default_hours'}), 400

    try:
        new_position = Position(
            title=data['title'],
            default_hours=float(data['default_hours']) # Ensure it's a float/decimal
        )
        db.session.add(new_position)
        db.session.commit()
        return jsonify(new_position.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        print(f"Error creating position: {e}")
        return jsonify({'message': 'Failed to create position.', 'details': str(e)}), 500

@app.route('/api/positions/<int:id>', methods=['PUT'])
def update_position(id):
    """Updates an existing position."""
    position = Position.query.get_or_404(id)
    data = request.get_json()
    if not data:
        return jsonify({'message': 'No data provided for update'}), 400

    if 'title' in data:
        position.title = data['title']
    if 'default_hours' in data:
        position.default_hours = float(data['default_hours'])

    try:
        db.session.commit()
        return jsonify(position.to_dict())
    except Exception as e:
        db.session.rollback()
        print(f"Error updating position: {e}")
        return jsonify({'message': 'Failed to update position.', 'details': str(e)}), 500

@app.route('/api/positions/<int:id>', methods=['DELETE'])
def delete_position(id):
    """Deletes a position."""
    position = Position.query.get_or_404(id)

    # Check for associated employees before deleting position
    if Employee.query.filter_by(position_id=id).count() > 0:
        return jsonify({'message': 'Cannot delete position with associated employees. Reassign employees first.'}), 409

    try:
        db.session.delete(position)
        db.session.commit()
        return jsonify({'message': 'Position deleted successfully'}), 204
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting position: {e}")
        return jsonify({'message': 'Failed to delete position.', 'details': str(e)}), 500

@app.route('/api/positions/reorder', methods=['PUT'])
def reorder_positions():
    data = request.get_json() # Expected: [{"position_id": 1, "order": 0}, {"position_id": 2, "order": 1}, ...]
    if not isinstance(data, list):
        return jsonify({'message': 'Expected a list of position order objects'}), 400

    try:
        for item in data:
            pos_id = item.get('position_id')
            new_order = item.get('order')
            if pos_id is None or new_order is None:
                return jsonify({'message': 'Missing position_id or order in one or more items'}), 400
            
            position = Position.query.get(pos_id)
            if position:
                position.display_order = new_order
            else:
                print(f"Warning: Position with ID {pos_id} not found for reordering. Skipping.")
        
        db.session.commit()
        return jsonify({'message': 'Position order updated successfully'}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error reordering positions: {e}")
        return jsonify({'message': 'An error occurred during reordering.', 'details': str(e)}), 500

@app.route('/api/employees', methods=['POST'])
def create_employee():
    data = request.get_json()
    required_fields = ['first_name', 'last_initial', 'position_id', 'primary_work_area_id', 'employment_start_date']
    if not all(field in data for field in required_fields):
        return jsonify({'message': 'Missing required data'}), 400

    try:
        # Convert date strings to date objects
        employment_start_date = date.fromisoformat(data['employment_start_date'])
        # employment_end_date can be empty string from frontend, convert to None
        employment_end_date = date.fromisoformat(data['employment_end_date']) if data.get('employment_end_date') else None
    except ValueError:
        return jsonify({'message': 'Invalid date format for employment dates. Use THAT-MM-DD.'}), 400

    if not WorkArea.query.get(data['primary_work_area_id']):
        return jsonify({'message': 'Primary Work Area not found'}), 400

    new_employee = Employee(
        first_name=data['first_name'],
        last_initial=data['last_initial'],
        position_id=data['position_id'],
        primary_work_area_id=data['primary_work_area_id'],
        employment_start_date=employment_start_date,
        employment_end_date=employment_end_date
    )
    
    try:
        db.session.add(new_employee)
        db.session.commit()
        return jsonify(new_employee.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        print(f"Error creating employee in DB: {e}")
        return jsonify({'message': 'Failed to create employee due to a database error.', 'details': str(e)}), 500

@app.route('/api/employees/<int:id>', methods=['PUT'])
def update_employee(id):
    employee = Employee.query.get_or_404(id)
    data = request.get_json()

    employee.first_name = data.get('first_name', employee.first_name)
    employee.last_initial = data.get('last_initial', employee.last_initial)
    employee.position_id = data['position_id']
    employee.primary_work_area_id = data.get('primary_work_area_id', employee.primary_work_area_id)

    if 'employment_start_date' in data:
        try:
            employee.employment_start_date = date.fromisoformat(data['employment_start_date'])
        except ValueError:
            return jsonify({'message': 'Invalid employment_start_date format. Use THAT-MM-DD.'}), 400
    
    if 'employment_end_date' in data:
        try:
            employee.employment_end_date = date.fromisoformat(data['employment_end_date']) if data['employment_end_date'] else None
        except ValueError:
            return jsonify({'message': 'Invalid employment_end_date format. Use THAT-MM-DD or leave empty.'}), 400

    if not WorkArea.query.get(employee.primary_work_area_id):
        return jsonify({'message': 'Primary Work Area not found after update'}), 400

    try:
        db.session.commit()
        return jsonify(employee.to_dict())
    except Exception as e:
        db.session.rollback()
        print(f"Error updating employee in DB: {e}")
        return jsonify({'message': 'Failed to save employee changes due to a database error.', 'details': str(e)}), 500

@app.route('/api/employees/<int:id>', methods=['DELETE'])
def delete_employee(id):
    employee = Employee.query.get_or_404(id)

    if DailyEmployeeHours.query.filter_by(employee_id=id).count() > 0:
        return jsonify({'message': 'Cannot delete employee with recorded hours. Delete associated daily hours entries first.'}), 409

    db.session.delete(employee)
    db.session.commit()
    return jsonify({'message': 'Employee deleted successfully'}), 204

@app.route('/api/employees/reorder', methods=['PUT'])
def reorder_employees():
    data = request.get_json() # Expected: [{"employee_id": 1, "order": 0}, {"employee_id": 2, "order": 1}, ...]
    if not isinstance(data, list):
        return jsonify({'message': 'Expected a list of employee order objects'}), 400

    try:
        for item in data:
            emp_id = item.get('employee_id')
            new_order = item.get('order')
            if emp_id is None or new_order is None:
                return jsonify({'message': 'Missing employee_id or order in one or more items'}), 400
            
            employee = Employee.query.get(emp_id)
            if employee:
                employee.display_order = new_order
            else:
                print(f"Warning: Employee with ID {emp_id} not found for reordering. Skipping.")
        
        db.session.commit()
        return jsonify({'message': 'Employee order updated successfully'}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error reordering employees: {e}")
        return jsonify({'message': 'An error occurred during reordering.', 'details': str(e)}), 500


# Overall Production Weeks API
@app.route('/api/overall-production-weeks', methods=['GET'])
def get_overall_production_weeks():
    weeks = OverallProductionWeek.query.order_by(OverallProductionWeek.reporting_week_start_date.desc()).all()
    return jsonify([week.to_dict() for week in weeks])

@app.route('/api/overall-production-weeks', methods=['POST'])
def create_overall_production_week():
    data = request.get_json()
    if not data or not 'reporting_week_start_date' in data:
        return jsonify({'message': 'Missing reporting_week_start_date parameter'}), 400

    try:
        reporting_start_date = date.fromisoformat(data['reporting_week_start_date'])
        reporting_end_date = reporting_start_date + timedelta(days=6)

        existing_week = OverallProductionWeek.query.filter_by(reporting_week_start_date=reporting_start_date).first()
        if existing_week:
            return jsonify({'message': f'A production schedule starting on {reporting_start_date.isoformat()} already exists.'}), 409

        new_week = OverallProductionWeek(
            reporting_week_start_date=reporting_start_date,
            reporting_week_end_date=reporting_end_date,
            forecasted_product_value=None,
            actual_product_value=None,
            forecasted_dollars_per_hour=None,
            actual_dollars_per_hour=None
        )
        db.session.add(new_week)
        db.session.commit()

        all_employees = Employee.query.all()
        forecasted_total_hours_for_week = 0

        for employee in all_employees:
            employee_work_area = employee.primary_work_area
            if not employee_work_area:
                print(f"Warning: Employee {employee.employee_id} has no primary work area. Skipping daily hours generation for this employee.")
                continue

            # --- Employee Employment Dates ---
            emp_start = employee.employment_start_date
            emp_end = employee.employment_end_date # This is the key variable for this bug

            offset_days = employee_work_area.reporting_week_start_offset_days
            contributing_start_date = reporting_start_date + timedelta(days=offset_days)
            contributing_end_date = contributing_start_date + timedelta(days=employee_work_area.contributing_duration_days - 1)

            current_date = contributing_start_date
            while current_date <= contributing_end_date:
                # --- CRITICAL FILTERING LOGIC ---
                is_employee_active_on_day = True
                if emp_start and current_date < emp_start: # If current_date is before employee's start date
                    is_employee_active_on_day = False
                if emp_end and current_date > emp_end: # If current_date is after employee's end date (emp_end is not None)
                    is_employee_active_on_day = False
                # --- END CRITICAL FILTERING LOGIC ---
                
                if is_employee_active_on_day:
                    if current_date.weekday() >= 0 and current_date.weekday() <= 4: # Monday (0) to Friday (4)
                        # --- CRITICAL FIX: Add Supervisor check ---
                        if employee.position == "Supervisor":
                            forecasted_hours_for_day = 8.0
                        elif employee.position == "Team Leader":
                            forecasted_hours_for_day = 7.75
                        elif employee.position == "Regular Staff":
                            forecasted_hours_for_day = 7.5
                        else:
                            forecasted_hours_for_day = 0.0
                        # --- END CRITICAL FIX ---
                    else: # Saturday (5) or Sunday (6)
                        forecasted_hours_for_day = 0.0 # Forecast 0 hours for weekend

                    daily_entry = DailyEmployeeHours(
                        employee_id=employee.employee_id,
                        work_area_id=employee_work_area.work_area_id,
                        work_date=current_date,
                        forecasted_hours=forecasted_hours_for_day,
                        actual_hours=None,
                        overall_production_week_id=new_week.overall_production_week_id
                    )
                    db.session.add(daily_entry)
                    forecasted_total_hours_for_week += float(forecasted_hours_for_day)

                current_date += timedelta(days=1)

        new_week.forecasted_total_production_hours = round(float(forecasted_total_hours_for_week), 2)
        db.session.commit()

        return jsonify(new_week.to_dict()), 201

    except ValueError:
        return jsonify({'message': 'Invalid date format. Use THAT-MM-DD.'}), 400
    except Exception as e:
        db.session.rollback()
        print(f"Error creating production schedule: {e}")
        return jsonify({'message': 'An error occurred while creating the production schedule.', 'details': str(e)}), 500

@app.route('/api/overall-production-weeks/<int:id>', methods=['PUT'])
def update_overall_production_week(id):
    week = OverallProductionWeek.query.get_or_404(id)
    data = request.get_json()

    week.forecasted_product_value = data.get('forecasted_product_value', week.forecasted_product_value)
    week.forecasted_boxes_built = data.get('forecasted_boxes_built', week.forecasted_boxes_built)

    week.actual_product_value = data.get('actual_product_value', week.actual_product_value)
    week.actual_boxes_built = data.get('actual_boxes_built', week.actual_boxes_built)

    f_prod_val = float(week.forecasted_product_value) if week.forecasted_product_value is not None else None
    f_total_hrs = float(week.forecasted_total_production_hours) if week.forecasted_total_production_hours is not None else None
    
    a_prod_val = float(week.actual_product_value) if week.actual_product_value is not None else None
    a_total_hrs = float(week.actual_total_production_hours) if week.actual_total_production_hours is not None else None

    week.forecasted_dollars_per_hour = calculate_dollars_per_hour(f_prod_val, f_total_hrs)
    week.actual_dollars_per_hour = calculate_dollars_per_hour(a_prod_val, a_total_hrs)

    db.session.commit()
    return jsonify(week.to_dict())

@app.route('/api/overall-production-weeks/<int:id>', methods=['DELETE'])
def delete_overall_production_week(id):
    week = OverallProductionWeek.query.get_or_404(id)

    if DailyEmployeeHours.query.filter_by(overall_production_week_id=id).count() > 0:
        return jsonify({'message': 'Cannot delete production schedule with associated daily hours. Delete associated daily hours first.'}), 409

    db.session.delete(week)
    db.session.commit()
    return jsonify({'message': 'Production Schedule deleted successfully'}), 204

# Daily Employee Hours API
@app.route('/api/daily-hours-entry', methods=['GET'])
def get_daily_hours_for_week():
    reporting_week_start_date_str = request.args.get('reporting_week_start_date')
    if not reporting_week_start_date_str:
        return jsonify({'message': 'Missing reporting_week_start_date parameter'}), 400

    try:
        reporting_week_start_date = date.fromisoformat(reporting_week_start_date_str)
    except ValueError:
        return jsonify({'message': 'Invalid date format for reporting_week_start_date. Use THAT-MM-DD.'}), 400

    if reporting_week_start_date.weekday() != 0: # 0 is Monday
        return jsonify({'message': 'reporting_week_start_date must be a Monday.'}), 400

    calendar_week_start_date = reporting_week_start_date - timedelta(days=1)

    calendar_week_end_date = calendar_week_start_date + timedelta(days=6)

    overall_production_week = OverallProductionWeek.query.filter_by(
        reporting_week_start_date=reporting_week_start_date
    ).first()

    current_overall_production_week_id = overall_production_week.overall_production_week_id if overall_production_week else None

    all_employees = Employee.query.order_by(Employee.display_order, Employee.employee_id).all()
    
    active_employees_for_week = []
    for emp in all_employees:
        emp_start = emp.employment_start_date
        emp_end = emp.employment_end_date

        employee_ends_before_week_starts = emp_end and emp_end < calendar_week_start_date
        employee_starts_after_week_ends = emp_start and emp_start > calendar_week_end_date
        
        if not employee_ends_before_week_starts and not employee_starts_after_week_ends:
            active_employees_for_week.append(emp)
    
    employees_to_process = active_employees_for_week


    work_areas = {wa.work_area_id: wa.to_dict() for wa in WorkArea.query.all()}

    ordered_work_areas = WorkArea.query.order_by(WorkArea.display_order, WorkArea.work_area_id).all()
    all_work_areas_for_response = [wa.to_dict() for wa in ordered_work_areas]

    response_data = []

    for employee in employees_to_process:
        employee_data = {
            'employee_id': employee.employee_id,
            'first_name': employee.first_name,
            'last_initial': employee.last_initial,
            'position_title': employee.position_obj.title if employee.position_obj else None, # Access title via position_obj relationship
            'position_id': employee.position_id, # Include position_id too if needed by frontend
            'primary_work_area_id': employee.primary_work_area_id,
            'primary_work_area_name': employee.primary_work_area.work_area_name if employee.primary_work_area else None,
            'daily_entries': []
        }

        current_date = calendar_week_start_date
        while current_date <= calendar_week_end_date:
            daily_hour_entry = DailyEmployeeHours.query.filter_by(
                employee_id=employee.employee_id,
                work_date=current_date
            ).first()

            # --- CRITICAL FIX: Reference default_hours from the Positions table via relationship ---
            default_forecasted_hours_for_day = 0.0 # Default to 0 for weekends or if position_obj is missing
            if current_date.weekday() >= 0 and current_date.weekday() <= 4: # Monday (0) to Friday (4)
                if employee.position_obj: # Ensure position_obj exists
                    default_forecasted_hours_for_day = float(employee.position_obj.default_hours)
                # If position_obj is None, default_forecasted_hours_for_day remains 0.0
            # --- END CRITICAL FIX ---

            is_employee_active_on_this_specific_day = True
            emp_start_for_day_check = employee.employment_start_date
            emp_end_for_day_check = employee.employment_end_date

            if emp_start_for_day_check and current_date < emp_start_for_day_check:
                is_employee_active_on_this_specific_day = False
            if emp_end_for_day_check and current_date > emp_end_for_day_check:
                is_employee_active_on_this_specific_day = False

            if not is_employee_active_on_this_specific_day:
                default_forecasted_hours_for_day = 0.0

            entry_data = {
                'work_date': current_date.isoformat(),
                'day_of_week': calendar.day_name[current_date.weekday()],
                'daily_hour_id': daily_hour_entry.daily_hour_id if daily_hour_entry else None,
                'forecasted_hours': str(daily_hour_entry.forecasted_hours) if daily_hour_entry else str(default_forecasted_hours_for_day),
                'actual_hours': str(daily_hour_entry.actual_hours) if daily_hour_entry and daily_hour_entry.actual_hours is not None else None,
                'work_area_id': daily_hour_entry.work_area_id if daily_hour_entry else employee.primary_work_area_id,
                'overall_production_week_id': daily_hour_entry.overall_production_week_id if daily_hour_entry else current_overall_production_week_id,
                'status': 'existing' if daily_hour_entry else 'new_potential'
            }
            employee_data['daily_entries'].append(entry_data)
            current_date += timedelta(days=1)
        response_data.append(employee_data)

    return jsonify({
        'employees_data': response_data,
        'all_work_areas': all_work_areas_for_response,
        'current_overall_production_week_id': current_overall_production_week_id,
        'message_if_no_week': 'No Overall Production Schedule found for this period. Please create it first in "Manage Production Schedules".' if current_overall_production_week_id is None else None
    })


@app.route('/api/daily-hours-entry/batch-update', methods=['POST'])
def batch_update_daily_hours():
    data = request.get_json()
    if not isinstance(data, list):
        return jsonify({'message': 'Expected a list of daily hour entries for batch update'}), 400

    try:
        for entry_data in data:
            daily_hour_id = entry_data.get('daily_hour_id')
            employee_id = entry_data.get('employee_id')
            work_date_str = entry_data.get('work_date')
            work_area_id = entry_data.get('work_area_id')
            actual_hours_str = entry_data.get('actual_hours')
            overall_production_week_id = entry_data.get('overall_production_week_id')

            if not all([employee_id, work_date_str, work_area_id]):
                return jsonify({'message': 'Missing required data (employee_id, work_date, work_area_id) in one or more entries.'}), 400
            
            if overall_production_week_id is None:
                return jsonify({'message': f'Cannot save entry for employee {employee_id} on {work_date_str}: Missing associated Overall Production Schedule ID. Please create the schedule first.'}), 400


            work_date = date.fromisoformat(work_date_str)
            actual_hours = float(actual_hours_str) if actual_hours_str is not None and actual_hours_str != '' else None

            if daily_hour_id:
                entry = DailyEmployeeHours.query.get(daily_hour_id)
                if not entry:
                    print(f"Warning: DailyHour entry {daily_hour_id} not found, skipping update.")
                    continue
                entry.actual_hours = actual_hours
                entry.work_area_id = work_area_id
            else:
                employee = Employee.query.get(employee_id)
                if not employee:
                    return jsonify({'message': f'Employee {employee_id} not found for new entry.'}), 400
                
                if work_date.weekday() >= 0 and work_date.weekday() <= 4:
                    forecasted_hours_for_day = 7.75 if employee.position == "Team Leader" else 7.5
                else:
                    forecasted_hours_for_day = 0.0

                new_entry = DailyEmployeeHours(
                    employee_id=employee_id,
                    work_area_id=work_area_id,
                    work_date=work_date,
                    forecasted_hours=forecasted_hours_for_day,
                    actual_hours=actual_hours,
                    overall_production_week_id=overall_production_week_id
                )
                db.session.add(new_entry)

        affected_week_ids = {entry['overall_production_week_id'] for entry in data if entry.get('overall_production_week_id') is not None}
        for week_id in affected_week_ids:
            overall_week = OverallProductionWeek.query.get(week_id)
            if overall_week:
                total_actual_hours = db.session.query(db.func.sum(DailyEmployeeHours.actual_hours)).filter(
                    DailyEmployeeHours.overall_production_week_id == week_id,
                    DailyEmployeeHours.actual_hours.isnot(None)
                ).scalar()
                overall_week.actual_total_production_hours = round(float(total_actual_hours) if total_actual_hours else 0, 2)

                actual_prod_val = float(overall_week.actual_product_value) if overall_week.actual_product_value is not None else None
                actual_total_hrs = float(overall_week.actual_total_production_hours) if overall_week.actual_total_production_hours is not None else None
                
                overall_week.actual_dollars_per_hour = calculate_dollars_per_hour(actual_prod_val, actual_total_hrs)

        db.session.commit()
        return jsonify({'message': 'Daily hours updated successfully'}), 200

    except ValueError as ve:
        db.session.rollback()
        return jsonify({'message': f'Data format error: {str(ve)}'}), 400
    except Exception as e:
        db.session.rollback()
        print(f"Error during batch update of daily hours: {e}")
        return jsonify({'message': 'An unexpected error occurred during batch update.', 'details': str(e)}), 500

@app.route('/api/daily-hours/update-forecasts', methods=['PUT'])
def update_daily_forecasts():
    data = request.get_json() # Expected: list of {daily_hour_id, new_forecasted_hours, ...}
    if not isinstance(data, list):
        return jsonify({'message': 'Expected a list of daily forecast update objects'}), 400

    try:
        for entry in data:
            daily_hour_id = entry.get('daily_hour_id')
            new_forecasted_hours = entry.get('new_forecasted_hours')
            employee_id = entry.get('employee_id')
            work_date_str = entry.get('work_date')
            work_area_id = entry.get('work_area_id')
            overall_production_week_id = entry.get('overall_production_week_id')


            if daily_hour_id is not None: # Update existing record
                daily_entry = DailyEmployeeHours.query.get(daily_hour_id)
                if daily_entry:
                    daily_entry.forecasted_hours = new_forecasted_hours
                else:
                    print(f"Warning: DailyHour entry {daily_hour_id} not found for update, skipping.")
            else: # Create new record if it doesn't exist (e.g., forecast for a manually added day)
                  # This path might be hit if a user tries to set forecast for a day that was not auto-generated
                  # and doesn't have an ID.
                if not all([employee_id, work_date_str, work_area_id, overall_production_week_id is not None]):
                    print(f"Warning: Missing data for new forecast entry: {entry}")
                    continue # Skip this entry

                work_date = date.fromisoformat(work_date_str)
                # Check if this exact record already exists (composite unique constraint)
                existing_entry = DailyEmployeeHours.query.filter_by(
                    employee_id=employee_id,
                    work_area_id=work_area_id,
                    work_date=work_date,
                    overall_production_week_id=overall_production_week_id
                ).first()

                if existing_entry:
                    existing_entry.forecasted_hours = new_forecasted_hours
                else:
                    new_daily_entry = DailyEmployeeHours(
                        employee_id=employee_id,
                        work_area_id=work_area_id,
                        work_date=work_date,
                        forecasted_hours=new_forecasted_hours,
                        actual_hours=None, # Actuals are handled by batch_update_daily_hours
                        overall_production_week_id=overall_production_week_id
                    )
                    db.session.add(new_daily_entry)
        
        # Recalculate total forecasted hours for affected production weeks
        affected_week_ids = {entry['overall_production_week_id'] for entry in data if entry.get('overall_production_week_id') is not None}
        for week_id in affected_week_ids:
            overall_week = OverallProductionWeek.query.get(week_id)
            if overall_week:
                total_forecasted_hours = db.session.query(db.func.sum(DailyEmployeeHours.forecasted_hours)).filter(
                    DailyEmployeeHours.overall_production_week_id == week_id,
                    DailyEmployeeHours.forecasted_hours.isnot(None)
                ).scalar()
                overall_week.forecasted_total_production_hours = round(float(total_forecasted_hours) if total_forecasted_hours else 0, 2)
        
        db.session.commit()
        return jsonify({'message': 'Forecasted hours updated successfully!'}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error updating forecasted hours: {e}")
        return jsonify({'message': 'An error occurred while updating forecasted hours.', 'details': str(e)}), 500


# Reports API
@app.route('/api/reports/weekly-overview', methods=['GET'])
def get_weekly_performance_overview():
    weeks = OverallProductionWeek.query.order_by(OverallProductionWeek.reporting_week_start_date.desc()).all()

    report_data = []
    for week in weeks:
        forecasted_dph = float(week.forecasted_dollars_per_hour) if week.forecasted_dollars_per_hour is not None else 0
        actual_dph = float(week.actual_dollars_per_hour) if week.actual_dollars_per_hour is not None else 0
        dph_variance = actual_dph - forecasted_dph
        dph_variance_pct = (dph_variance / forecasted_dph * 100) if forecasted_dph != 0 else 0

        forecasted_boxes = week.forecasted_boxes_built if week.forecasted_boxes_built is not None else 0
        actual_boxes = week.actual_boxes_built if week.actual_boxes_built is not None else 0
        boxes_variance = actual_boxes - forecasted_boxes
        boxes_variance_pct = (boxes_variance / forecasted_boxes * 100) if forecasted_boxes != 0 else 0

        forecasted_total_hrs = float(week.forecasted_total_production_hours) if week.forecasted_total_production_hours is not None else 0
        actual_total_hrs = float(week.actual_total_production_hours) if week.actual_total_production_hours is not None else 0
        total_hrs_variance = actual_total_hrs - forecasted_total_hrs
        total_hrs_variance_pct = (total_hrs_variance / forecasted_total_hrs * 100) if forecasted_total_hrs != 0 else 0

        report_data.append({
            'overall_production_week_id': week.overall_production_week_id,
            'reporting_week_start_date': week.reporting_week_start_date.isoformat(),
            'reporting_week_end_date': week.reporting_week_end_date.isoformat(),

            'forecasted_product_value': str(week.forecasted_product_value) if week.forecasted_product_value is not None else None,
            'actual_product_value': str(week.actual_product_value) if week.actual_product_value is not None else None,

            'forecasted_dollars_per_hour': str(week.forecasted_dollars_per_hour) if week.forecasted_dollars_per_hour is not None else None,
            'actual_dollars_per_hour': str(week.actual_dollars_per_hour) if week.actual_dollars_per_hour is not None else None,
            'dph_variance': f"{dph_variance:.2f}",
            'dph_variance_pct': f"{dph_variance_pct:.2f}%",

            'forecasted_boxes_built': week.forecasted_boxes_built,
            'actual_boxes_built': week.actual_boxes_built,
            'boxes_variance': boxes_variance,
            'boxes_variance_pct': f"{boxes_variance_pct:.2f}%",

            'forecasted_total_production_hours': str(week.forecasted_total_production_hours) if week.forecasted_total_production_hours is not None else None,
            'actual_total_production_hours': str(week.actual_total_production_hours) if week.actual_total_production_hours is not None else None,
            'total_hrs_variance': f"{total_hrs_variance:.2f}",
            'total_hrs_variance_pct': f"{total_hrs_variance_pct:.2f}%",
        })

    return jsonify(report_data)

@app.route('/api/reports/monthly-work-area-hours', methods=['GET'])
def get_monthly_work_area_hours_report():
    selected_year = request.args.get('year')
    last_12_months = request.args.get('last_12_months') == 'true'

    try:
        query = db.session.query(
            extract('year', DailyEmployeeHours.work_date).label('year'),
            extract('month', DailyEmployeeHours.work_date).label('month'),
            WorkArea.work_area_name,
            func.sum(DailyEmployeeHours.forecasted_hours).label('total_forecasted_hours'),
            func.sum(DailyEmployeeHours.actual_hours).label('total_actual_hours')
        ).join(WorkArea)

        if last_12_months:
            today = date.today()
            start_date_12_months_ago = today.replace(day=1) - timedelta(days=365)
            start_date_12_months_ago = start_date_12_months_ago.replace(day=1)
            end_date_last_month = today.replace(day=1) - timedelta(days=1)
            query = query.filter(
                DailyEmployeeHours.work_date >= start_date_12_months_ago,
                DailyEmployeeHours.work_date <= end_date_last_month
            )
        elif selected_year:
            query = query.filter(extract('year', DailyEmployeeHours.work_date) == int(selected_year))

        report_data = query.group_by(
            extract('year', DailyEmployeeHours.work_date),
            extract('month', DailyEmployeeHours.work_date),
            WorkArea.work_area_name,
            WorkArea.work_area_id
        ).order_by(
            WorkArea.display_order.asc(),
            extract('year', DailyEmployeeHours.work_date).asc(),
            extract('month', DailyEmployeeHours.work_date).asc()
        ).all()

        formatted_report = []
        for row in report_data:
            total_forecasted = float(row.total_forecasted_hours) if row.total_forecasted_hours is not None else 0.0
            total_actual = float(row.total_actual_hours) if row.total_actual_hours is not None else 0.0

            formatted_report.append({
                'year': int(row.year),
                'month': int(row.month),
                'work_area_name': row.work_area_name,
                'total_forecasted_hours': f"{total_forecasted:.2f}",
                'total_actual_hours': f"{total_actual:.2f}",
            })
        
        return jsonify(formatted_report), 200

    except Exception as e:
        print(f"Error generating monthly work area report: {e}")
        return jsonify({'message': 'An error occurred while generating the report.', 'details': str(e)}), 500

@app.route('/api/reports/monthly-employee-hours', methods=['GET'])
def get_monthly_employee_hours_report():
    sort_by = request.args.get('sort_by', 'display_order') # Default sort by display_order
    sort_direction = request.args.get('sort_direction', 'asc') # Default sort direction ascending
    selected_year = request.args.get('year')
    last_12_months = request.args.get('last_12_months') == 'true'

    try:
        query = db.session.query(
            extract('year', DailyEmployeeHours.work_date).label('year'),
            extract('month', DailyEmployeeHours.work_date).label('month'),
            Employee.first_name,
            Employee.last_initial,
            Employee.display_order, # Ensure display_order is selected
            func.sum(DailyEmployeeHours.forecasted_hours).label('total_forecasted_hours'),
            func.sum(DailyEmployeeHours.actual_hours).label('total_actual_hours')
        ).join(Employee)

        # Apply filters (selected_year, last_12_months)
        selected_year = request.args.get('year')
        last_12_months = request.args.get('last_12_months') == 'true'

        if last_12_months:
            today = date.today()
            start_date_12_months_ago = today.replace(day=1) - timedelta(days=365)
            start_date_12_months_ago = start_date_12_months_ago.replace(day=1)
            end_date_last_month = today.replace(day=1) - timedelta(days=1)
            query = query.filter(
                DailyEmployeeHours.work_date >= start_date_12_months_ago,
                DailyEmployeeHours.work_date <= end_date_last_month
            )
        elif selected_year:
            query = query.filter(extract('year', DailyEmployeeHours.work_date) == int(selected_year))

        # Define base aggregations (forecasted_sum, actual_sum, etc. remain the same)
        forecasted_sum = func.sum(DailyEmployeeHours.forecasted_hours)
        actual_sum = func.sum(DailyEmployeeHours.actual_hours)
        
        # Explicitly cast sums to Float for calculations, handling potential NULLs
        forecasted_sum_float = db.case((forecasted_sum.is_(None), 0.0), else_=forecasted_sum).cast(db.Float)
        actual_sum_float = db.case((actual_sum.is_(None), 0.0), else_=actual_sum).cast(db.Float)
        
        variance_hours_sum = actual_sum_float - forecasted_sum_float
        
        # Safely calculate variance_pct_val for sorting, ensuring float type
        variance_pct_val = db.case(
            (forecasted_sum_float != 0, (variance_hours_sum * 100.0) / forecasted_sum_float),
            (db.and_(forecasted_sum_float == 0, actual_sum_float == 0), 0.0),
            (actual_sum_float > 0, 999999999.0), # Use large float literal for effectively +infinity
            (actual_sum_float < 0, -999999999.0), # Use large float literal for effectively -infinity
            else_=0.0
        ).cast(db.Float)

        # Select the aggregate expressions as labeled columns
        query = db.session.query(
            extract('year', DailyEmployeeHours.work_date).label('year'),
            extract('month', DailyEmployeeHours.work_date).label('month'),
            Employee.first_name,
            Employee.last_initial,
            Employee.display_order,
            forecasted_sum.label('total_forecasted_hours'),
            actual_sum.label('total_actual_hours'),
            variance_hours_sum.label('total_variance_hours'),
            variance_pct_val.label('total_variance_pct')
        ).join(Employee)


        # Define sorting columns based on sort_by parameter
        if sort_by == 'employee_name':
            primary_order_exp = Employee.first_name
            secondary_order_exp = Employee.last_initial
        elif sort_by == 'forecasted_hours':
            primary_order_exp = forecasted_sum_float
            secondary_order_exp = Employee.display_order # Tie-breaker
        elif sort_by == 'actual_hours':
            primary_order_exp = actual_sum_float
            secondary_order_exp = Employee.display_order # Tie-breaker
        elif sort_by == 'variance':
            primary_order_exp = variance_hours_sum
            secondary_order_exp = Employee.display_order # Tie-breaker
        elif sort_by == 'variance_pct':
            primary_order_exp = variance_pct_val
            secondary_order_exp = Employee.display_order # Tie-breaker
        elif sort_by == 'display_order':
            primary_order_exp = Employee.display_order
            secondary_order_exp = Employee.employee_id # Tie-breaker for display_order itself
        else: # Fallback for unknown sort_by, typically display_order
            primary_order_exp = Employee.display_order
            secondary_order_exp = Employee.employee_id
            
        # Apply sort direction and explicit NULL handling for numerical columns
        ordering_columns = []
        
        # Primary Sort
        if sort_direction == 'desc':
            if sort_by in ['employee_name']: # Text sorting (employee_name)
                ordering_columns.append(primary_order_exp.desc())
            else: # Numerical sorts (forecasted_hours, actual_hours, variance, variance_pct, display_order)
                # Nulls should typically go last in descending order for numerical sorts
                ordering_columns.append(primary_order_exp.desc().nullslast())
            
            # Secondary Sort (Tie-breaker for Primary)
            if secondary_order_exp is not None:
                ordering_columns.append(secondary_order_exp.desc())
            
            # Month/Year sorting (descending for newest first, within employee)
            ordering_columns.append(extract('year', DailyEmployeeHours.work_date).desc())
            ordering_columns.append(extract('month', DailyEmployeeHours.work_date).desc())

        else: # asc
            if sort_by in ['employee_name']: # Text sorting (employee_name)
                ordering_columns.append(primary_order_exp.asc())
            else: # Numerical sorts
                # Nulls should typically go first in ascending order for numerical sorts
                ordering_columns.append(primary_order_exp.asc().nullsfirst())
            
            # Secondary Sort (Tie-breaker for Primary)
            if secondary_order_exp is not None:
                ordering_columns.append(secondary_order_exp.asc())
            
            # Month/Year sorting (ascending for oldest first, within employee)
            ordering_columns.append(extract('year', DailyEmployeeHours.work_date).asc())
            ordering_columns.append(extract('month', DailyEmployeeHours.work_date).asc())
            
        # --- CRITICAL FIX: Simplify backend ordering to a base order ---
        report_data = query.group_by(
            extract('year', DailyEmployeeHours.work_date),
            extract('month', DailyEmployeeHours.work_date),
            Employee.employee_id,
            Employee.first_name,
            Employee.last_initial,
            Employee.display_order
        ).order_by(
            # Base order: Employee display order, then by year and month
            Employee.display_order.asc(),
            extract('year', DailyEmployeeHours.work_date).desc(), # Newest month first
            extract('month', DailyEmployeeHours.work_date).desc()
        ).all()
        # --- END CRITICAL FIX ---

        # --- DEBUGGING LOGS FOR REPORT DATA AFTER SORTING (Ensure these are present) ---
        # print("\n--- DEBUG: Monthly Employee Report Data After Sorting ---")
        # for row in report_data:
        #     # Print relevant fields for debugging sort order
        #     # Ensure numbers are converted to float before calculation/formatting for accurate print
        #     forecasted_val = float(row.total_forecasted_hours) if row.total_forecasted_hours is not None else 0.0
        #     actual_val = float(row.total_actual_hours) if row.total_actual_hours is not None else 0.0
        #     variance_val = actual_val - forecasted_val # Calculate variance for printing clarity

        #     print(f"  Employee: {row.first_name} {row.last_initial}, Order: {row.display_order}, "
        #           f"Month: {row.year}-{row.month}, "
        #           f"Forecasted: {forecasted_val:.2f}, "
        #           f"Actual: {actual_val:.2f}, "
        #           f"Variance_Hrs: {variance_val:.2f}")
        # print("----------------------------------------------------\n")
        # --- END DEBUG LOGS ---

        formatted_report = []
        for row in report_data:
            # Use the selected labels from the query
            total_forecasted = float(row.total_forecasted_hours) if row.total_forecasted_hours is not None else 0.0
            total_actual = float(row.total_actual_hours) if row.total_actual_hours is not None else 0.0
            # Get variance values from the new selected labels
            variance = float(row.total_variance_hours) if row.total_variance_hours is not None else 0.0
            variance_pct = float(row.total_variance_pct) if row.total_variance_pct is not None else 0.0
            
            formatted_report.append({
                'year': int(row.year),
                'month': int(row.month),
                'employee_name': f"{row.first_name} {row.last_initial}",
                'total_forecasted_hours': f"{total_forecasted:.2f}",
                'total_actual_hours': f"{total_actual:.2f}",
                'variance': f"{variance:.2f}",
                'variance_pct': f"{variance_pct:.2f}%",
            })
        
        return jsonify(formatted_report), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error generating monthly employee report: {e}")
        return jsonify({'message': 'An error occurred while generating the report.', 'details': str(e)}), 500

@app.route('/api/reports/monthly-company-actuals', methods=['GET'])
def get_monthly_company_actuals_report():
    selected_year = request.args.get('year')
    last_12_months = request.args.get('last_12_months') == 'true'

    try:
        query = db.session.query(
            extract('year', OverallProductionWeek.reporting_week_start_date).label('year'),
            extract('month', OverallProductionWeek.reporting_week_start_date).label('month'),
            func.sum(OverallProductionWeek.actual_product_value).label('total_actual_product_value'),
            func.sum(OverallProductionWeek.actual_total_production_hours).label('total_actual_hours_sum'),
            func.sum(OverallProductionWeek.actual_boxes_built).label('total_actual_boxes')
        )

        if last_12_months:
            today = date.today()
            start_date_12_months_ago = today.replace(day=1) - timedelta(days=365)
            start_date_12_months_ago = start_date_12_months_ago.replace(day=1)
            end_date_last_month = today.replace(day=1) - timedelta(days=1)
            query = query.filter(
                OverallProductionWeek.reporting_week_start_date >= start_date_12_months_ago,
                OverallProductionWeek.reporting_week_start_date <= end_date_last_month
            )
        elif selected_year:
            query = query.filter(extract('year', OverallProductionWeek.reporting_week_start_date) == int(selected_year))

        report_data = query.group_by(
            extract('year', OverallProductionWeek.reporting_week_start_date),
            extract('month', OverallProductionWeek.reporting_week_start_date)
        ).order_by(
            extract('year', OverallProductionWeek.reporting_week_start_date).asc(),
            extract('month', OverallProductionWeek.reporting_week_start_date).asc()
        ).all()

        formatted_report = []
        for row in report_data:
            total_product_value_sum = float(row.total_actual_product_value) if row.total_actual_product_value is not None else 0.0
            total_hours_sum = float(row.total_actual_hours_sum) if row.total_actual_hours_sum is not None else 0.0
            total_boxes = int(row.total_actual_boxes) if row.total_actual_boxes is not None else 0

            calculated_dph = 0.0
            if total_hours_sum > 0:
                calculated_dph = round(total_product_value_sum / total_hours_sum, 2)

            formatted_report.append({
                'year': int(row.year),
                'month': int(row.month),
                'total_actual_dph': f"{calculated_dph:.2f}",
                'total_actual_boxes': total_boxes,
            })
        
        return jsonify(formatted_report), 200

    except Exception as e:
        print(f"Error generating monthly company actuals report: {e}")
        return jsonify({'message': 'An error occurred while generating the company actuals report.', 'details': str(e)}), 500
    
@app.route('/api/reports/email-monthly-report', methods=['POST'])
def email_chart_report():
    data = request.get_json()
    recipient = data.get('recipient')
    image_data_base64 = data.get('image_data') # Base64 string of the chart image
    subject = data.get('subject', 'Monthly Report')
    # --- NEW: Receive report summaries from frontend ---
    work_area_summary_html = data.get('work_area_summary_html', '') # HTML string of the work area table
    employee_summary_html = data.get('employee_summary_html', '') # HTML string of the employee table
    # --- END NEW ---

    if not recipient or not image_data_base64:
        return jsonify({'message': 'Missing recipient or image data'}), 400

    try:
        # Decode Base64 image data
        header, encoded = image_data_base64.split(",", 1)
        image_binary_data = base64.b64decode(encoded)

        # --- NEW: Construct the email message (MIMEMultipart('related')) ---
        # MIMEMultipart('related') allows embedding images in HTML
        msg = MIMEMultipart('related')
        msg['From'] = formataddr((SENDER_NAME, SENDER_EMAIL))
        msg['To'] = recipient
        msg['Subject'] = subject

        # Create the HTML part of the email
        html_body = f"""
        <html>
        <head></head>
        <body style="font-family: 'Century Gothic', Arial, sans-serif;">
            <p>Please find your Monthly Performance Report below.</p>
            
            <h3>Monthly Actual Hours by Work Area (Graph)</h3>
            <img src="cid:chart_image" alt="Monthly Work Area Report Chart" style="max-width: 100%; height: auto; display: block; margin-bottom: 20px;">
            
            <h3>Report Details:</h3>
            <div style="font-size: 14px; color: #333;">
                <h4>Work Area Performance:</h4>
                <div style="margin-bottom: 20px;">{work_area_summary_html}</div>
                
                <h4>Employee Performance:</h4>
                <div>{employee_summary_html}</div>
            </div>

            <p>Regards,</p>
            <p>Your Production App</p>
        </body>
        </html>
        """
        # Create a plain text fallback part
        plain_text_body = """
        Dear recipient,

        Please find your Monthly Performance Report attached as an image.

        --- Monthly Work Area Performance ---
        (Table content could go here in plain text, but is complex to format)
        --- Monthly Employee Performance ---
        (Table content could go here in plain text)

        Please view the email in an HTML-compatible client to see the full report.

        Regards,
        Your Production App
        """

        # Attach alternative content (plain text and HTML)
        alt_msg = MIMEMultipart('alternative')
        alt_msg.attach(MIMEText(plain_text_body, 'plain'))
        alt_msg.attach(MIMEText(html_body, 'html'))
        msg.attach(alt_msg)

        # Attach the image (referenced by cid:chart_image in HTML)
        image = MIMEImage(image_binary_data, name='monthly_report_chart.png')
        image.add_header('Content-ID', '<chart_image>') # Link to cid:chart_image in HTML
        msg.attach(image)
        # --- END NEW EMAIL CONSTRUCTION ---

        # Connect to SMTP server and send email
        with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT) as server:
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)

        return jsonify({'message': 'Email sent successfully!'}), 200

    except Exception as e:
        print(f"Error sending email: {e}")
        return jsonify({'message': f'Failed to send email: {str(e)}', 'details': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)