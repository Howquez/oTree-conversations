from otree.api import *
import random

doc = """
Your app description
"""


class C(BaseConstants):
    NAME_IN_URL = 'questionnaire'
    PLAYERS_PER_GROUP = None
    NUM_ROUNDS = 1

    QUESTIONNAIRE_TEMPLATE = "outro/T_Questionnaire.html"

class Subsession(BaseSubsession):
    pass


class Group(BaseGroup):
    pass


class Player(BasePlayer):
    completed_survey = models.BooleanField(doc="indicates whether a participant has completed the survey.",
                                           initial=False,
                                           blank=True)

    # Interface
    interface_1 = models.IntegerField(
        doc="Overall, this interface worked very well technically.",
        label="Overall, this interface worked very well technically.",
        widget=widgets.RadioSelect,
        choices=[1, 2, 3, 4, 5, 6, 7])

    interface_2 = models.IntegerField(
        doc="Visually, this interface resembled other interfaces I think highly of.",
        label="Visually, this interface resembled other interfaces I think highly of.",
        widget=widgets.RadioSelect,
        choices=[1, 2, 3, 4, 5, 6, 7])

    interface_3 = models.IntegerField(
        doc="this interface was simple to navigate.",
        label="This interface was simple to navigate.",
        widget=widgets.RadioSelect,
        choices=[1, 2, 3, 4, 5, 6, 7])

    interface_4 = models.IntegerField(
        doc="With this interface, it was very easy to submit my decision.",
        label="With this interface, it was very easy to submit my decision.",
        widget=widgets.RadioSelect,
        choices=[1, 2, 3, 4, 5, 6, 7])

    interface_5 = models.IntegerField(
        doc="This interface allowed me to efficiently communicate my decision.",
        label="This interface allowed me to efficiently communicate my decision.",
        widget=widgets.RadioSelect,
        choices=[1, 2, 3, 4, 5, 6, 7])

    interface_6 = models.IntegerField(
        doc="This interface was somewhat intimidating to me.",
        label="This interface was somewhat intimidating to me.",
        widget=widgets.RadioSelect,
        choices=[1, 2, 3, 4, 5, 6, 7])

    interface_7 = models.IntegerField(
        doc="It scared me to think that I could provide a wrong answer using this interface.",
        label="It scared me to think that I could provide a wrong answer using this interface.",
        widget=widgets.RadioSelect,
        choices=[1, 2, 3, 4, 5, 6, 7])

    realism_1 = models.IntegerField(
        doc="The voice interface felt realistic.",
        label="The voice interface felt realistic.",
        widget=widgets.RadioSelect,
        choices=[1, 2, 3, 4, 5, 6, 7])

    realism_2 = models.IntegerField(
        doc="I could imagine using a system like this in real life.",
        label="I could imagine using a system like this in real life.",
        widget=widgets.RadioSelect,
        choices=[1, 2, 3, 4, 5, 6, 7])

    familiarity = models.IntegerField(
        label="How familiar would you consider yourself to be with voice-activated technologies (e.g., website, car, app, speakers)?",
        doc="How familiar would you consider yourself to be with voice-activated technologies (e.g., website, car, app, speakers)?",
        widget=widgets.RadioSelect,
        choices=[1, 2, 3, 4, 5, 6, 7],
        blank=False)

# Situational covariates
    location = models.IntegerField(
        label="Where were you when you were while making the decisions in the current study?",
        blank=False,
        widget=widgets.RadioSelect,
        choices=[
            [1, "In a public space (e.g., coffee shop) near other people."],
            [2, "In a public space where NO ONE was around."],
            [3, "In a personal space (e.g., home or office) near other people."],
            [4, "In a personal space (e.g., home or office) where NO ONE was around."],
        ]
    )

    disguise_1 = models.IntegerField(
        label="Did you disguise your voice during the current study?",
        blank=False,
        widget=widgets.RadioSelect,
        choices=[
            [0, "No"],
            [1, "Yes"],
        ]
    )

    disguise_2 = models.IntegerField(
        label="As I was saying my decision out loud, I was speaking as if I was talking to a person.",
        doc="As I was saying my decision out loud, I was speaking as if I was talking to a person.",
        widget=widgets.RadioSelect,
        choices=[1, 2, 3, 4, 5, 6, 7],
        blank=False)

    naturalness_1 = models.IntegerField(
        label="Speaking my choices felt natural.",
        doc="Speaking my choices felt natural.",
        widget=widgets.RadioSelect,
        choices=[1, 2, 3, 4, 5, 6, 7],
        blank=False)

# Demographics
    age = models.IntegerField(label="Please enter your age",
                              min=18,
                              max=99)

    gender = models.IntegerField(
        label="Please select your gender.",
        choices=[
            [1, "Female"],
            [2, "Male"],
            [3, "Other"],
            [4, "Prefer not to say"],
        ]
    )

    income = models.IntegerField(
        label="What was your total household income before taxes during the past 12 months?",
        blank=False,
        widget=widgets.RadioSelect,
        choices=[
            [1, "Less than $25,000"],
            [2, "$25,000-$49,999"],
            [3, "$50,000-$74,999"],
            [4, "$75,000-$99,999"],
            [5, "$100,000-$149,999"],
            [4, "$150,000 or more"],
            [4, "Prefer not to say"],
        ]
    )


# Turn-taking
    turntaking_1 = models.IntegerField(
        label="The voice interface and I sometimes spoke at the same time.",
        doc="The voice interface and I sometimes spoke at the same time.",
        widget=widgets.RadioSelect,
        choices=[1, 2, 3, 4, 5, 6, 7],
        blank=False)

    turntaking_2 = models.IntegerField(
        label="I sometimes started speaking before the voice interface finished.",
        doc="I sometimes started speaking before the voice interface finished.",
        widget=widgets.RadioSelect,
        choices=[1, 2, 3, 4, 5, 6, 7],
        blank=False)

    turntaking_3 = models.IntegerField(
        label="The voice interface sometimes started speaking before I finished.",
        doc="The voice interface sometimes started speaking before I finished.",
        widget=widgets.RadioSelect,
        choices=[1, 2, 3, 4, 5, 6, 7],
        blank=False)

# OTF
    OTF = models.LongStringField(label="Please use the box below to share your thoughts about the study (e.g., any aspects you particularly liked or disliked) to help us improve it.", blank=False)



# PAGES

class A_Instructions(Page):
    pass

class Interface(Page):
    form_model = "player"

    @staticmethod
    def get_form_fields(player: Player):
        form_fields = ["interface_1", "interface_2", "interface_3", "interface_4", "interface_5", "interface_6", "interface_7", "realism_1", "realism_2"]
        random.shuffle(form_fields)
        return form_fields


class Familiarity(Page):
    form_model = "player"
    form_fields = ["familiarity"]


class Situation(Page):
    form_model = "player"
    form_fields = ["location", "disguise_1", "disguise_2", "naturalness_1"]


class Demographics(Page):
    form_model = "player"
    form_fields = ["age", "gender", "income"]
    @staticmethod
    def before_next_page(player, timeout_happened):
        player.participant.finished = True
        player.completed_survey = player.participant.finished

class Open_Text(Page):
    form_model = "player"
    form_fields = ["OTF"]

class Other_Ideas(Page):
    form_model = "player"
    form_fields = ["easy_choices", "hard_choices"]

class Interaction(Page):
    form_model = "player"
    form_fields = ["turntaking_1", "turntaking_2", "turntaking_3"]


class Debriefing(Page):
    pass


page_sequence = [ A_Instructions,
                 Open_Text,
                 Interface,
                 Interaction,
                 Familiarity,
                 Situation,
                 Demographics,
                 Debriefing]
