# app.py

from flask import Flask, request, jsonify, render_template, redirect, url_for, flash
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from config import Config
from datetime import date, timedelta, datetime
from sqlalchemy import func, extract
from forms import LoginForm
from functools import wraps
import calendar # For getting day names

import smtplib
import base64
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
from email.utils import formataddr
import os # For environment variables
from dotenv import load_dotenv

from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, SubmitField
from wtforms.validators import DataRequired, Length, EqualTo, ValidationError
from flask_bcrypt import Bcrypt

load_dotenv()

app = Flask(__name__)
app.config.from_object(Config)
db = SQLAlchemy(app)
migrate = Migrate(app, db) # Initialize Flask-Migrate

bcrypt = Bcrypt(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login' # The route to redirect to if a user isn't logged in
login_manager.login_message_category = 'info' # For flash messages

# --- SMTP Configuration from Environment Variables ---
SMTP_SERVER = os.environ.get('SMTP_SERVER')
SMTP_PORT = int(os.environ.get('SMTP_PORT'))
SMTP_USERNAME = os.environ.get('SMTP_USERNAME')
SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL')
SENDER_NAME = os.environ.get('SENDER_NAME')
# --- END NEW ---


# --- Helper Functions ---
def get_sunday_of_week(any_date):
    days_to_subtract = (any_date.weekday() + 1) % 7
    return any_date - timedelta(days=days_to_subtract)

def get_monday_of_week(d):
    date_obj = date(d.year, d.month, d.day)
    day = date_obj.weekday()
    if day == 6: # Sunday
        date_obj += timedelta(days=1)
        day = date_obj.weekday()
    days_to_subtract = day
    monday_of_week = date_obj - timedelta(days=days_to_subtract)
    return monday_of_week

def calculate_dollars_per_hour(value, hours):
    if hours is None or float(hours) == 0:
        return None
    if value is None:
        return None
    try:
        return round(float(value) / float(hours), 2)
    except (ValueError, TypeError):
        return None


# --- Database Models ---

class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(20), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(60), nullable=False)

    def get_id(self):
       return str(self.id)
    

class WorkArea(db.Model):
    __tablename__ = 'work_areas'
    work_area_id = db.Column(db.Integer, primary_key=True)
    work_area_name = db.Column(db.String(100), unique=True, nullable=False)
    reporting_week_start_offset_days = db.Column(db.Integer, nullable=False)
    contributing_duration_days = db.Column(db.Integer, default=7, nullable=False)
    display_order = db.Column(db.Integer, nullable=True)

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
    position_id = db.Column(db.Integer, db.ForeignKey('positions.position_id'), nullable=False)
    primary_work_area_id = db.Column(db.Integer, db.ForeignKey('work_areas.work_area_id'), nullable=False)
    display_order = db.Column(db.Integer, nullable=False, server_default='999999')

    employment_start_date = db.Column(db.Date, nullable=False)
    employment_end_date = db.Column(db.Date, nullable=True)

    daily_hours_entries = db.relationship('DailyEmployeeHours', backref='employee', lazy=True)

    def __repr__(self):
        return f"<Employee {self.first_name} {self.last_initial}>"

    def to_dict(self):
        return {
            'employee_id': self.employee_id,
            'first_name': self.first_name,
            'last_initial': self.last_initial,
            'position_id': self.position_id,
            'position_title': self.position_obj.title if self.position_obj else None,
            'primary_work_area_id': self.primary_work_area_id,
            'primary_work_area_name': self.primary_work_area.work_area_name if self.primary_work_area else None,
            'default_forecasted_daily_hours': str(self.position_obj.default_hours) if self.position_obj else None,
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
    default_hours = db.Column(db.Numeric(4, 2), nullable=False)
    display_order = db.Column(db.Integer, nullable=False, server_default='999999')
    employees = db.relationship('Employee', backref='position_obj', lazy=True)

    def __repr__(self):
        return f"<Position {self.title} ({self.default_hours} hrs)>"

    def to_dict(self):
        return {
            'position_id': self.position_id,
            'title': self.title,
            'default_hours': str(self.default_hours),
            'display_order': self.display_order
        }

class Notification(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    message = db.Column(db.String(255), nullable=False)
    is_read = db.Column(db.Boolean, default=False, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    link = db.Column(db.String(255), nullable=True)
    user = db.relationship('User', backref=db.backref('notifications', lazy=True))

    def __repr__(self):
        return f'<Notification {self.message}>'

class Holiday(db.Model):
    __tablename__ = 'holidays'
    id = db.Column(db.Integer, primary_key=True)
    holiday_date = db.Column(db.Date, unique=True, nullable=False)
    description = db.Column(db.String(100), nullable=False)

    def __repr__(self):
        return f"<Holiday {self.description} on {self.holiday_date}>"

    def to_dict(self):
        return {
            'id': self.id,
            'holiday_date': self.holiday_date.isoformat(),
            'description': self.description
        }

# --- NEW MODELS FOR SHIFT SUMMARIES ---
class Job(db.Model):
    __tablename__ = 'jobs'
    job_id = db.Column(db.Integer, primary_key=True)
    job_tag = db.Column(db.String(100), unique=True, nullable=False)
    num_sheets = db.Column(db.Integer, nullable=True)
    num_mdf_doors = db.Column(db.Integer, nullable=True)
    linear_meters_edgebanding = db.Column(db.Float, nullable=True)
    num_drawer_boxes = db.Column(db.Integer, nullable=True)
    boxes_mcp = db.Column(db.Integer, nullable=True)
    boxes_pvc = db.Column(db.Integer, nullable=True)
    boxes_paint = db.Column(db.Integer, nullable=True)
    boxes_stain = db.Column(db.Integer, nullable=True)
    boxes_natural = db.Column(db.Integer, nullable=True)
    boxes_glaze = db.Column(db.Integer, nullable=True)

    def to_dict(self):
        return {
            'job_id': self.job_id,
            'job_tag': self.job_tag,
            'num_sheets': self.num_sheets,
            'num_mdf_doors': self.num_mdf_doors,
            'linear_meters_edgebanding': self.linear_meters_edgebanding,
            'num_drawer_boxes': self.num_drawer_boxes,
            'boxes_mcp': self.boxes_mcp,
            'boxes_pvc': self.boxes_pvc,
            'boxes_paint': self.boxes_paint,
            'boxes_stain': self.boxes_stain,
            'boxes_natural': self.boxes_natural,
            'boxes_glaze': self.boxes_glaze
        }

class DailyShiftSummary(db.Model):
    __tablename__ = 'daily_shift_summaries'
    summary_id = db.Column(db.Integer, primary_key=True)
    summary_date = db.Column(db.Date, nullable=False)
    department = db.Column(db.String(100), nullable=False)
    job_id = db.Column(db.Integer, db.ForeignKey('jobs.job_id'), nullable=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.employee_id'), nullable=False)
    station = db.Column(db.String(100), nullable=True)
    sheets_cut_mtr = db.Column(db.Integer, nullable=True)
    sheets_cut_cs43 = db.Column(db.Integer, nullable=True)
    mdf_doors_cut_mtr = db.Column(db.Integer, nullable=True)
    mdf_doors_cut_cs43 = db.Column(db.Integer, nullable=True)
    edgebanding_ran = db.Column(db.Float, nullable=True)
    edgebanding_changeovers = db.Column(db.Integer, nullable=True)
    manual_edgebanding = db.Column(db.Integer, nullable=True)
    drawer_boxes_built = db.Column(db.Integer, nullable=True)
    boxes_prepped = db.Column(db.Integer, nullable=True)
    boxes_built = db.Column(db.Integer, nullable=True)
    boxes_hung = db.Column(db.Integer, nullable=True)
    team_leader = db.Column(db.String(100))
    shift = db.Column(db.String(50))
    notes = db.Column(db.Text)
    job = db.relationship('Job', backref='daily_shift_summaries')
    employee = db.relationship('Employee', backref='daily_shift_summaries')

    def to_dict(self):
        return {
            'summary_id': self.summary_id,
            'summary_date': self.summary_date.isoformat(),
            'department': self.department,
            'job_id': self.job_id,
            'job_tag': self.job.job_tag if self.job else None,
            'employee_id': self.employee_id,
            'employee_name': self.employee.name if self.employee else None,
            'station': self.station,
            'sheets_cut_mtr': self.sheets_cut_mtr,
            'sheets_cut_cs43': self.sheets_cut_cs43,
            'mdf_doors_cut_mtr': self.mdf_doors_cut_mtr,
            'mdf_doors_cut_cs43': self.mdf_doors_cut_cs43,
            'edgebanding_ran': self.edgebanding_ran,
            'edgebanding_changeovers': self.edgebanding_changeovers,
            'manual_edgebanding': self.manual_edgebanding,
            'drawer_boxes_built': self.drawer_boxes_built,
            'boxes_prepped': self.boxes_prepped,
            'boxes_built': self.boxes_built,
            'boxes_hung': self.boxes_hung,
            'team_leader': self.team_leader,
            'shift': self.shift,
            'notes': self.notes
        }

class FinishingWork(db.Model):
    __tablename__ = 'finishing_work'
    finishing_id = db.Column(db.Integer, primary_key=True)
    job_id = db.Column(db.Integer, db.ForeignKey('jobs.job_id'), nullable=True)
    manual_part_name = db.Column(db.String(100), nullable=True)
    finish_type = db.Column(db.String(50), nullable=False)
    stage = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(50), nullable=True)
    stage_completed_date = db.Column(db.Date, nullable=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.employee_id'), nullable=True)
    batch_number = db.Column(db.String(50))
    job = db.relationship('Job', backref='finishing_work')
    employee = db.relationship('Employee', backref='finishing_work')

    def to_dict(self):
        return {
            'finishing_id': self.finishing_id,
            'job_id': self.job_id,
            'job_tag': self.job.job_tag if self.job else None,
            'manual_part_name': self.manual_part_name,
            'finish_type': self.finish_type,
            'stage': self.stage,
            'status': self.status,
            'stage_completed_date': self.stage_completed_date.isoformat() if self.stage_completed_date else None,
            'employee_id': self.employee_id,
            'employee_name': self.employee.name if self.employee else None,
            'batch_number': self.batch_number
        }
# --- END NEW MODELS ---


@app.cli.command("create-user")
def create_user():
    """Creates a new user."""
    import getpass
    username = input("Enter username: ")
    email = input("Enter email: ")
    password = getpass.getpass("Enter password: ")
    confirm_password = getpass.getpass("Confirm password: ")

    if password != confirm_password:
        print("Passwords do not match.")
        return

    # Check if user already exists
    if User.query.filter_by(username=username).first() or User.query.filter_by(email=email).first():
        print("User with that username or email already exists.")
        return
        
    password_hash = bcrypt.generate_password_hash(password).decode('utf-8')
    new_user = User(username=username, email=email, password_hash=password_hash)
    
    db.session.add(new_user)
    db.session.commit()
    print(f"User '{username}' created successfully.")

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

def api_login_required(func):
    @wraps(func)
    def decorated_view(*args, **kwargs):
        if not current_user.is_authenticated:
            return jsonify(message="Authentication is required to access this API."), 401
        return func(*args, **kwargs)
    return decorated_view

# --- Frontend Serving Routes ---
@app.route('/')
@login_required
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
    upcoming_holidays = Holiday.query.filter(Holiday.holiday_date >= today).count()

    return render_template('index.html',
                           total_employees=total_employees,
                           total_work_areas=total_work_areas,
                           total_positions=total_positions,
                           this_months_hours=this_months_hours,
                           upcoming_holidays=upcoming_holidays)

@app.route('/work_areas')
@login_required
def work_areas_page():
    return render_template('work_areas.html')

@app.route('/employees')
@login_required
def employees_page():
    return render_template('employees.html')

@app.route('/positions')
@login_required
def positions_page():
    return render_template('positions.html')

@app.route('/production_weeks')
@login_required
def production_weeks_page():
    return render_template('production_weeks.html')

@app.route('/daily-hours-entry')
@login_required
def daily_hours_entry_page():
    return render_template('daily_hours_entry.html')

@app.route('/reports')
@login_required
def reports_page():
    return render_template('reports.html')

@app.route('/monthly-work-area-hours-report')
@login_required
def monthly_work_area_hours_report_page():
    return render_template('monthly_work_area_hours_report.html')

@app.route('/get_notifications')
@login_required
def get_notifications():
    notifications = Notification.query.filter_by(user_id=current_user.id, is_read=False).order_by(Notification.timestamp.desc()).all()
    return jsonify([{
        'id': n.id,
        'message': n.message,
        'link': n.link,
        'timestamp': n.timestamp.strftime('%Y-%m-%d %H:%M:%S')
    } for n in notifications])

@app.before_request
def mark_notification_as_read():
    if not current_user.is_authenticated:
        return
    notification_id = request.args.get('notification_id', type=int)
    if notification_id:
        print(f"--- MARK AS READ DEBUG: Found notification_id={notification_id} in URL.")
        print(f"--- MARK AS READ DEBUG: Current user ID is {current_user.id}.")
        notification = Notification.query.filter_by(id=notification_id, user_id=current_user.id).first()
        if notification:
            print(f"--- MARK AS READ DEBUG: Successfully found notification object: {notification}")
            notification.is_read = True
            db.session.commit()
            print("--- MARK AS READ DEBUG: Notification marked as read and committed.")
        else:
            print("--- MARK AS READ DEBUG: FAILED to find a matching notification for this user.")

@app.route('/holidays')
@login_required
def holidays_page():
    return render_template('holidays.html')

@app.route('/jobs')
@login_required
def jobs_page():
    return render_template('jobs.html')

@app.route('/daily-summary')
@login_required
def daily_summary_page():
    return render_template('daily_summary.html')

@app.route('/finishing-wip')
@login_required
def finishing_wip_page():
    return render_template('finishing_wip.html')

# --- API Endpoints ---
@app.route('/api/holidays', methods=['GET'])
@api_login_required
def get_holidays():
    holidays = Holiday.query.order_by(Holiday.holiday_date.asc()).all()
    return jsonify([h.to_dict() for h in holidays])

@app.route('/api/holidays', methods=['POST'])
@api_login_required
def add_holiday():
    data = request.get_json()
    if not data or not data.get('description') or not data.get('holiday_date'):
        return jsonify({'message': 'Missing description or date'}), 400
    try:
        holiday_date = date.fromisoformat(data['holiday_date'])
        if Holiday.query.filter_by(holiday_date=holiday_date).first():
            return jsonify({'message': 'A holiday for this date already exists'}), 409
        new_holiday = Holiday(description=data['description'], holiday_date=holiday_date)
        db.session.add(new_holiday)
        db.session.commit()
        return jsonify(new_holiday.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': str(e)}), 500

@app.route('/api/holidays/<int:id>', methods=['DELETE'])
@api_login_required
def delete_holiday(id):
    holiday = Holiday.query.get_or_404(id)
    db.session.delete(holiday)
    db.session.commit()
    return jsonify({'message': 'Holiday deleted successfully'}), 200

# --- API Endpoints ---

# Work Areas API
@app.route('/api/work-areas', methods=['GET'])
@api_login_required
def get_work_areas():
    work_areas = WorkArea.query.order_by(WorkArea.display_order, WorkArea.work_area_id).all()
    return jsonify([wa.to_dict() for wa in work_areas])

@app.route('/api/work-areas', methods=['POST'])
@api_login_required
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
@api_login_required
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
@api_login_required
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
@api_login_required
def reorder_work_areas():
    data = request.get_json()
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
@api_login_required
def get_positions():
    positions = Position.query.order_by(Position.display_order, Position.position_id).all()
    return jsonify([p.to_dict() for p in positions])

# Employees API
@app.route('/api/employees', methods=['GET'])
@api_login_required
def get_employees():
    employees = Employee.query.order_by(Employee.display_order, Employee.employee_id).all()
    return jsonify([emp.to_dict() for emp in employees])

@app.route('/api/positions', methods=['POST'])
@api_login_required
def create_position():
    data = request.get_json()
    if not data or not 'title' in data or not 'default_hours' in data:
        return jsonify({'message': 'Missing title or default_hours'}), 400
    try:
        new_position = Position(
            title=data['title'],
            default_hours=float(data['default_hours'])
        )
        db.session.add(new_position)
        db.session.commit()
        return jsonify(new_position.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        print(f"Error creating position: {e}")
        return jsonify({'message': 'Failed to create position.', 'details': str(e)}), 500

@app.route('/api/positions/<int:id>', methods=['PUT'])
@api_login_required
def update_position(id):
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
@api_login_required
def delete_position(id):
    position = Position.query.get_or_404(id)
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
@api_login_required
def reorder_positions():
    data = request.get_json()
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
@api_login_required
def create_employee():
    data = request.get_json()
    required_fields = ['first_name', 'last_initial', 'position_id', 'primary_work_area_id', 'employment_start_date']
    if not all(field in data for field in required_fields):
        return jsonify({'message': 'Missing required data'}), 400
    try:
        employment_start_date = date.fromisoformat(data['employment_start_date'])
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
@api_login_required
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
@api_login_required
def delete_employee(id):
    employee = Employee.query.get_or_404(id)
    if DailyEmployeeHours.query.filter_by(employee_id=id).count() > 0:
        return jsonify({'message': 'Cannot delete employee with recorded hours. Delete associated daily hours entries first.'}), 409
    db.session.delete(employee)
    db.session.commit()
    return jsonify({'message': 'Employee deleted successfully'}), 204

@app.route('/api/employees/reorder', methods=['PUT'])
@api_login_required
def reorder_employees():
    data = request.get_json()
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
@api_login_required
def get_overall_production_weeks():
    weeks = OverallProductionWeek.query.order_by(OverallProductionWeek.reporting_week_start_date.desc()).all()
    return jsonify([week.to_dict() for week in weeks])

@app.route('/api/overall-production-weeks', methods=['POST'])
@api_login_required
def create_overall_production_week():
    """
    Creates a new overall production week and generates the corresponding daily
    forecasted hours for all active employees, factoring in company holidays.
    """
    data = request.get_json()
    if not data or 'reporting_week_start_date' not in data:
        return jsonify({'message': 'Missing reporting_week_start_date parameter'}), 400

    try:
        reporting_start_date = date.fromisoformat(data['reporting_week_start_date'])
        
        # Ensure the start date is a Monday
        if reporting_start_date.weekday() != 0:
            return jsonify({'message': 'Reporting week start date must be a Monday.'}), 400

        # Check if a week with this start date already exists
        if OverallProductionWeek.query.filter_by(reporting_week_start_date=reporting_start_date).first():
            return jsonify({'message': f'A production schedule starting on {reporting_start_date.isoformat()} already exists.'}), 409

        # Create the new production week record
        new_week = OverallProductionWeek(
            reporting_week_start_date=reporting_start_date,
            reporting_week_end_date=reporting_start_date + timedelta(days=6),
            forecasted_product_value=None,
            actual_product_value=None,
            forecasted_dollars_per_hour=None,
            actual_dollars_per_hour=None
        )
        db.session.add(new_week)
        db.session.commit() # Commit here to get the new_week.overall_production_week_id

        # --- HOLIDAY INTEGRATION ---
        # 1. Get all holiday dates from the database once for efficient lookup.
        holiday_dates = {h.holiday_date for h in Holiday.query.all()}
        # --- END HOLIDAY INTEGRATION ---

        all_employees = Employee.query.all()
        forecasted_total_hours_for_week = 0

        for employee in all_employees:
            employee_work_area = employee.primary_work_area
            if not employee_work_area:
                print(f"Warning: Employee {employee.employee_id} has no primary work area. Skipping daily hours generation for this employee.")
                continue

            # Determine the date range for which this employee's hours contribute to the schedule
            offset_days = employee_work_area.reporting_week_start_offset_days
            contributing_start_date = reporting_start_date + timedelta(days=offset_days)
            contributing_end_date = contributing_start_date + timedelta(days=employee_work_area.contributing_duration_days - 1)

            current_date = contributing_start_date
            while current_date <= contributing_end_date:
                
                # Check if the employee is actively employed on the current date
                is_employee_active_on_day = not (
                    (employee.employment_start_date and current_date < employee.employment_start_date) or
                    (employee.employment_end_date and current_date > employee.employment_end_date)
                )

                forecasted_hours_for_day = 0.0 # Default to 0

                # --- HOLIDAY INTEGRATION ---
                # 2. Assign hours only if it's a weekday, not a holiday, and the employee is active.
                if is_employee_active_on_day and current_date not in holiday_dates and current_date.weekday() < 5:
                    # If conditions are met, get the default hours from the employee's position
                    if employee.position_obj:
                        forecasted_hours_for_day = float(employee.position_obj.default_hours)
                # --- END HOLIDAY INTEGRATION ---

                # Create the daily hours record
                daily_entry = DailyEmployeeHours(
                    employee_id=employee.employee_id,
                    work_area_id=employee_work_area.work_area_id,
                    work_date=current_date,
                    forecasted_hours=forecasted_hours_for_day,
                    actual_hours=None,
                    overall_production_week_id=new_week.overall_production_week_id
                )
                db.session.add(daily_entry)
                forecasted_total_hours_for_week += forecasted_hours_for_day

                current_date += timedelta(days=1)

        # Update the total forecasted hours on the parent week record
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
@api_login_required
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
@api_login_required
def delete_overall_production_week(id):
    week = OverallProductionWeek.query.get_or_404(id)

    #if DailyEmployeeHours.query.filter_by(overall_production_week_id=id).count() > 0:
    #    return jsonify({'message': 'Cannot delete production schedule with associated daily hours. Delete associated daily hours first.'}), 409

    db.session.delete(week)
    db.session.commit()
    return jsonify({'message': 'Production Schedule deleted successfully'}), 204

# Daily Employee Hours API
@app.route('/api/daily-hours-entry', methods=['GET'])
@api_login_required
def get_daily_hours_for_week():
    reporting_week_start_date_str = request.args.get('reporting_week_start_date')
    if not reporting_week_start_date_str:
        return jsonify({'message': 'Missing reporting_week_start_date parameter'}), 400

    try:
        reporting_week_start_date = date.fromisoformat(reporting_week_start_date_str)
    except ValueError:
        return jsonify({'message': 'Invalid date format for reporting_week_start_date. Use THAT-MM-DD.'}), 400

    if reporting_week_start_date.weekday() != 0:  # 0 is Monday
        return jsonify({'message': 'reporting_week_start_date must be a Monday.'}), 400

    calendar_week_start_date = reporting_week_start_date - timedelta(days=1)
    calendar_week_end_date = calendar_week_start_date + timedelta(days=6)

    overall_production_week = OverallProductionWeek.query.filter_by(
        reporting_week_start_date=reporting_week_start_date
    ).first()

    if not overall_production_week:
        return jsonify({
            'employees_data': [],
            'all_work_areas': [wa.to_dict() for wa in WorkArea.query.order_by(WorkArea.display_order).all()],
            'current_overall_production_week_id': None,
            'message_if_no_week': 'No Overall Production Schedule found for this period. Please create it first in "Manage Production Schedules".'
        })

    current_overall_production_week_id = overall_production_week.overall_production_week_id

    all_entries_in_date_range = DailyEmployeeHours.query.filter(
        DailyEmployeeHours.work_date.between(calendar_week_start_date, calendar_week_end_date)
    ).all()
    entries_map = {(entry.employee_id, entry.work_date): entry for entry in all_entries_in_date_range}

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

    ordered_work_areas = WorkArea.query.order_by(WorkArea.display_order, WorkArea.work_area_id).all()
    
    # --- THIS LINE IS NOW CORRECTED ---
    all_work_areas_for_response = [wa.to_dict() for wa in ordered_work_areas]
    # --- END CORRECTION ---

    response_data = []
    for employee in employees_to_process:
        employee_data = {
            'employee_id': employee.employee_id,
            'first_name': employee.first_name,
            'last_initial': employee.last_initial,
            'position_title': employee.position_obj.title if employee.position_obj else None,
            'position_id': employee.position_id,
            'primary_work_area_id': employee.primary_work_area_id,
            'primary_work_area_name': employee.primary_work_area.work_area_name if employee.primary_work_area else None,
            'daily_entries': []
        }

        current_date = calendar_week_start_date
        while current_date <= calendar_week_end_date:
            daily_hour_entry = entries_map.get((employee.employee_id, current_date))

            default_forecasted_hours_for_day = 0.0
            if current_date.weekday() <= 4:
                if employee.position_obj:
                    default_forecasted_hours_for_day = float(employee.position_obj.default_hours)

            is_employee_active = not (
                (employee.employment_start_date and current_date < employee.employment_start_date) or
                (employee.employment_end_date and current_date > employee.employment_end_date)
            )

            if not is_employee_active:
                default_forecasted_hours_for_day = 0.0

            entry_data = {
                'work_date': current_date.isoformat(),
                'day_of_week': calendar.day_name[current_date.weekday()],
                'daily_hour_id': daily_hour_entry.daily_hour_id if daily_hour_entry else None,
                'forecasted_hours': str(daily_hour_entry.forecasted_hours) if daily_hour_entry else str(default_forecasted_hours_for_day),
                'actual_hours': str(daily_hour_entry.actual_hours) if daily_hour_entry and daily_hour_entry.actual_hours is not None else None,
                'work_area_id': daily_hour_entry.work_area_id if daily_hour_entry else employee.primary_work_area_id,
                'overall_production_week_id': current_overall_production_week_id,
                'status': 'existing' if daily_hour_entry else 'new_potential'
            }
            employee_data['daily_entries'].append(entry_data)
            current_date += timedelta(days=1)
        response_data.append(employee_data)

    return jsonify({
        'employees_data': response_data,
        'all_work_areas': all_work_areas_for_response,
        'current_overall_production_week_id': current_overall_production_week_id,
        'message_if_no_week': None
    })

@app.route('/api/daily-hours-entry/batch-update', methods=['POST'])
@api_login_required
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

        # --- BEGIN NOTIFICATION LOGIC ---
        # This implementation notifies all other users. A future enhancement could be
        # to implement user roles and notify only specific managers.
        if affected_week_ids:
            # Get all users who should be notified (everyone except the person making the change)
            recipients = User.query.filter(User.id != current_user.id).all()
            print(f"--- DEBUG: Found {len(recipients)} recipients ---") # <-- ADD THIS
            
            for week_id in affected_week_ids:
                week = OverallProductionWeek.query.get(week_id)
                if week and recipients:
                    message = f'{current_user.username} updated hours for the week of {week.reporting_week_start_date.strftime("%b %d, %Y")}.'
                    print(f"--- DEBUG: Generated message: {message} ---") # <-- ADD THIS
                    
                    # Create a link that will take the user directly to the correct week
                    link = url_for('daily_hours_entry_page', _external=True) + f'?reporting_week_start_date={week.reporting_week_start_date.isoformat()}'

                    for recipient in recipients:
                        notification = Notification(
                            user_id=recipient.id,
                            message=message,
                            link=link
                        )
                        db.session.add(notification)
            
            print("--- DEBUG: Committing notifications to database ---") # <-- ADD THIS
            db.session.commit()
        # --- END NOTIFICATION LOGIC ---

        return jsonify({'message': 'Daily hours updated successfully'}), 200

    except ValueError as ve:
        db.session.rollback()
        return jsonify({'message': f'Data format error: {str(ve)}'}), 400
    except Exception as e:
        db.session.rollback()
        print(f"Error during batch update of daily hours: {e}")
        return jsonify({'message': 'An unexpected error occurred during batch update.', 'details': str(e)}), 500

@app.route('/api/daily-hours/update-forecasts', methods=['PUT'])
@api_login_required
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
@api_login_required
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
@api_login_required
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
@api_login_required
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
@api_login_required
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
@api_login_required
def email_chart_report():
    data = request.get_json()
    # OLD Way: recipient = data.get('recipient')
    recipient = current_user.email

    image_data_base64 = data.get('image_data') # Base64 string of the chart image
    subject = data.get('subject', 'Monthly Report')
    # --- NEW: Receive report summaries from frontend ---
    work_area_summary_html = data.get('work_area_summary_html', '') # HTML string of the work area table
    employee_summary_html = data.get('employee_summary_html', '') # HTML string of the employee table
    # --- END NEW ---
    # Add checks for missing data
    if not recipient:
        return jsonify({'message': 'Your account does not have an email address.'}), 400
    if not image_data_base64:
        return jsonify({'message': 'Missing image data'}), 400

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

# --- NEW API ENDPOINTS FOR SHIFT SUMMARIES ---
@app.route('/api/jobs', methods=['GET', 'POST'])
@api_login_required
def handle_jobs():
    if request.method == 'POST':
        data = request.get_json()
        new_job = Job(**data)
        db.session.add(new_job)
        db.session.commit()
        return jsonify({'message': 'Job created successfully'}), 201
    else:
        jobs = Job.query.all()
        return jsonify([job.to_dict() for job in jobs])

@app.route('/api/jobs/<int:job_id>', methods=['GET', 'PUT', 'DELETE'])
@api_login_required
def handle_job(job_id):
    job = Job.query.get_or_404(job_id)
    if request.method == 'GET':
        return jsonify(job.to_dict())
    elif request.method == 'PUT':
        data = request.get_json()
        for key, value in data.items():
            setattr(job, key, value)
        db.session.commit()
        return jsonify({'message': 'Job updated successfully'})
    elif request.method == 'DELETE':
        db.session.delete(job)
        db.session.commit()
        return jsonify({'message': 'Job deleted successfully'})

@app.route('/api/daily_shift_summary', methods=['POST'])
@api_login_required
def add_daily_shift_summary():
    data = request.get_json()
    new_summary = DailyShiftSummary(**data)
    db.session.add(new_summary)
    db.session.commit()
    return jsonify({'message': 'Daily shift summary added successfully'}), 201

@app.route('/api/finishing_work', methods=['GET', 'POST'])
@api_login_required
def handle_finishing_work():
    if request.method == 'POST':
        data = request.get_json()
        new_work = FinishingWork(**data)
        db.session.add(new_work)
        db.session.commit()
        return jsonify({'message': 'Finishing work created successfully'}), 201
    else:
        work_items = FinishingWork.query.all()
        return jsonify([item.to_dict() for item in work_items])

@app.route('/api/finishing_work/<int:finishing_id>', methods=['PUT'])
@api_login_required
def update_finishing_work(finishing_id):
    work_item = FinishingWork.query.get_or_404(finishing_id)
    data = request.get_json()
    work_item.stage = data.get('stage', work_item.stage)
    work_item.status = data.get('status', work_item.status)
    work_item.stage_completed_date = data.get('stage_completed_date', work_item.stage_completed_date)
    work_item.employee_id = data.get('employee_id', work_item.employee_id)
    db.session.commit()
    return jsonify({'message': 'Finishing work updated successfully'})
# --- END NEW API ENDPOINTS ---

@app.route("/login", methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    form = LoginForm()
    if form.validate_on_submit():
        user = User.query.filter_by(username=form.username.data).first()
        if user and bcrypt.check_password_hash(user.password_hash, form.password.data):
            login_user(user, remember=True)
            next_page = request.args.get('next')
            return redirect(next_page) if next_page else redirect(url_for('index'))
        else:
            # In a real app, you would use flash messages here
            print("Login Unsuccessful. Please check username and password")
    return render_template('login.html', title='Login', form=form)

@app.route("/logout")
def logout():
    logout_user()
    return redirect(url_for('login'))

if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=True)