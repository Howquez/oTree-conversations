from os import environ

SESSION_CONFIGS = [
    # dict(
    #     name='voice_decision',
    #     app_sequence=['onboarding', 'voice', 'outro'],
    #     num_demo_participants=3,
    # ),
    dict(
        name='voice_chat',
        app_sequence=['chat', 'outro'],
        num_demo_participants=3,
    ),
    # dict(
    #     name='voice_chat_eleven',
    #     app_sequence=['eleven', 'outro'],
    #     num_demo_participants=3,
    # ),
    dict(
        name='seat_preference',
        app_sequence=['onboarding', 'seating', 'seating_slider', 'outro'],
        num_demo_participants=3,
    ),
]

# if you set a property in SESSION_CONFIG_DEFAULTS, it will be inherited by all configs
# in SESSION_CONFIGS, except those that explicitly override it.
# the session config can be accessed from methods in your apps as self.session.config,
# e.g. self.session.config['participation_fee']

SESSION_CONFIG_DEFAULTS = dict(
    real_world_currency_per_point=1.00, participation_fee=0.00, doc="",
    rerecord=True,
    listen=True,
    transcript=True,
)

PARTICIPANT_FIELDS = ["finished"]
SESSION_FIELDS = []

ROOMS = [
    dict(
        name='expRoom',
        display_name='expRoom 1',
    ),
]

# ISO-639 code
# for example: de, fr, ja, ko, zh-hans
LANGUAGE_CODE = 'en'

# e.g. EUR, GBP, CNY, JPY
REAL_WORLD_CURRENCY_CODE = 'USD'
USE_POINTS = True

ADMIN_USERNAME = 'admin'
# for security, best to set admin password in an environment variable
ADMIN_PASSWORD = environ.get('OTREE_ADMIN_PASSWORD')

DEMO_PAGE_INTRO_HTML = """ """

SECRET_KEY = '6923766713139'
