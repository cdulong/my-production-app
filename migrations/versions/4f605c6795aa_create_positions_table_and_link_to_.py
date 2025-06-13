"""Create positions table and link to employees (fixed alter column)

Revision ID: 4f605c6795aa
Revises: 960ca0d5c77c
Create Date: 2025-06-11 16:03:24.672459

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text # Import text for raw SQL
from datetime import date # Import date for default (if needed)

# revision identifiers, used by Alembic.
revision = '4f605c6795aa'
down_revision = '960ca0d5c77c'
branch_labels = None
depends_on = None


def upgrade():
    # Step 1: Create 'positions' table
    op.create_table(
        'positions',
        sa.Column('position_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=50), nullable=False),
        sa.Column('default_hours', sa.Numeric(precision=4, scale=2), nullable=False),
        sa.PrimaryKeyConstraint('position_id'),
        sa.UniqueConstraint('title')
    )

    # Step 2: Add 'position_id' column to 'employees' table
    with op.batch_alter_table('employees', schema=None) as batch_op:
        # Add as nullable=True temporarily
        batch_op.add_column(sa.Column('position_id', sa.Integer(), nullable=True)) 

    # Step 3: Populate 'positions' table with existing data
    op.execute(text("INSERT INTO positions (title, default_hours) VALUES ('Regular Staff', 7.50)"))
    op.execute(text("INSERT INTO positions (title, default_hours) VALUES ('Team Leader', 7.75)"))
    op.execute(text("INSERT INTO positions (title, default_hours) VALUES ('Supervisor', 8.00)"))

    # Step 4: Update existing 'employees' to link to new 'positions' table
    # This uses raw SQL to update the new position_id based on the old position string
    # Assuming old 'position' column still exists at this point
    op.execute(text("""
        UPDATE employees
        SET position_id = p.position_id
        FROM positions AS p
        WHERE employees.position = p.title;
    """))

    # Step 5: Alter 'position_id' column to be NOT NULL and add foreign key constraint
    with op.batch_alter_table('employees', schema=None) as batch_op:
        batch_op.alter_column('position_id',
                           existing_type=sa.Integer(),
                           nullable=False, # Make it NOT NULL
                           existing_nullable=True) # It was nullable before this step

        # Add foreign key constraint
        batch_op.create_foreign_key('fk_employees_positions',
                                    'positions',
                                    ['position_id'],
                                    ['position_id'])

        # Step 6: Drop the old 'position' column (string type)
        batch_op.drop_column('position')


def downgrade():
    # Revert 'employees' table first
    with op.batch_alter_table('employees', schema=None) as batch_op:
        # Re-add the original 'position' column
        batch_op.add_column(sa.Column('position', sa.String(length=50), nullable=True)) # Add back as nullable
        # Optionally backfill data if needed on downgrade, e.g.:
        # op.execute(text("UPDATE employees SET position = (SELECT title FROM positions WHERE positions.position_id = employees.position_id)"))

        # Drop foreign key constraint
        batch_op.drop_constraint('fk_employees_positions', type_='foreignkey')
        # Drop the new 'position_id' column
        batch_op.drop_column('position_id')

    # Drop 'positions' table
    op.drop_table('positions')
