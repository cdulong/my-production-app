from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, SubmitField
from wtforms.validators import DataRequired

class LoginForm(FlaskForm):
    username = StringField(
        'Username', 
        validators=[DataRequired()], 
        render_kw={
            "placeholder": "User Name",
            "autocomplete": "username"
            }
    )
    password = PasswordField(
        'Password', 
        validators=[DataRequired()], 
        render_kw={
            "placeholder": "Password",
            "autocomplete": "current-password"
            }
    )
    submit = SubmitField('Log In')