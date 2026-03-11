from otree.api import *
import pandas as pd

doc = """
Slider follow-up for the seating app — same pairs, same order, strength-of-preference rating.
"""

_STIMULI = (
    pd.read_csv('_static/global/stimuli_seating.csv', sep=';')
    .apply(lambda col: col.str.strip() if col.dtype == 'object' else col)
    .to_dict('records')
)


class C(BaseConstants):
    NAME_IN_URL = 'seating_slider'
    PLAYERS_PER_GROUP = None
    NUM_ROUNDS = len(_STIMULI)


class Subsession(BaseSubsession):
    pass


class Group(BaseGroup):
    pass


class Player(BasePlayer):
    choice_pair = models.IntegerField(blank=True)
    choice = models.StringField(blank=True)
    strength = models.IntegerField(
        doc="Slider response: -50 = strongly prefer Seat A, 0 = no preference, +50 = strongly prefer Seat B.",
        min=-50,
        max=50,
    )


class Instructions(Page):
    @staticmethod
    def is_displayed(player: Player):
        return player.round_number == 1


class Slider(Page):
    form_model = 'player'
    form_fields = ['strength']

    @staticmethod
    def vars_for_template(player: Player):
        current = player.participant.vars['choices'][player.round_number - 1]
        player.choice_pair = int(current['pair_id'])
        player.choice = player.participant.vars.get('seating_choices', {}).get(player.round_number, '')
        return dict(
            seat_A=current['seat_A'],
            seat_B=current['seat_B'],
        )


page_sequence = [Instructions, Slider]
