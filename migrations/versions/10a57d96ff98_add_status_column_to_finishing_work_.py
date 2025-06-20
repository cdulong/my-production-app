"""Add status column to finishing_work table

Revision ID: 10a57d96ff98
Revises: bcc5ea74fceb
Create Date: 2025-06-19 10:30:03.742830

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '10a57d96ff98'
down_revision = 'bcc5ea74fceb'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('finishing_work', schema=None) as batch_op:
        batch_op.add_column(sa.Column('status', sa.String(length=50), nullable=True))

    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('finishing_work', schema=None) as batch_op:
        batch_op.drop_column('status')

    # ### end Alembic commands ###
