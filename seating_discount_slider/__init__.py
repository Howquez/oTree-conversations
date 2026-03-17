from otree.api import *
import pandas as pd

doc = """
Slider follow-up for the seating discount task — same two pairs, strength-of-preference rating.
"""

_STIMULI = (
    pd.read_csv('_static/global/stimuli_seating.csv', sep=';')
    .apply(lambda col: col.str.strip() if col.dtype == 'object' else col)
    .to_dict('records')
)

_DISCOUNT_AMOUNT = 25


class C(BaseConstants):
    NAME_IN_URL = 'seating_discount_slider'
    PLAYERS_PER_GROUP = None
    NUM_ROUNDS = 2


class Subsession(BaseSubsession):
    pass


class Group(BaseGroup):
    pass


class Player(BasePlayer):
    choice_pair = models.IntegerField(blank=True)
    original_choice = models.StringField(blank=True)
    discount_seat = models.StringField(blank=True)
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
        pair_id = player.participant.vars['discount_pairs'][player.round_number - 1]
        stimulus = next(s for s in _STIMULI if int(s['pair_id']) == pair_id)
        seat_a = stimulus['seat_A']
        seat_b = stimulus['seat_B']

        original_choice = player.participant.vars.get('seating_choices_by_pair', {}).get(pair_id, '')
        discount_seat = 'seat_B' if original_choice == 'seat_A' else 'seat_A'

        player.choice_pair = pair_id
        player.original_choice = original_choice
        player.discount_seat = discount_seat
        player.choice = player.participant.vars.get('discount_choices', {}).get(pair_id, '')

        return dict(
            seat_A=seat_a,
            seat_B=seat_b,
            discount_seat=discount_seat,
            discount_amount=_DISCOUNT_AMOUNT,
        )


page_sequence = [Instructions, Slider]
