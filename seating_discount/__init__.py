from otree.api import *
import boto3
from botocore.config import Config as BotoConfig
import os
import httpx
import random
import hashlib
import pandas as pd
from dotenv import load_dotenv

load_dotenv()

doc = """
Discount follow-up to the seating task. Two randomly selected seat pairs are
shown again, this time with the unchosen seat offered at a $25 discount.
Participants state via voice whether they would switch.
"""

_STIMULI = (
    pd.read_csv('_static/global/stimuli_seating.csv', sep=';')
    .apply(lambda col: col.str.strip() if col.dtype == 'object' else col)
    .to_dict('records')
)

_DISCOUNT_AMOUNT = 25
_NUM_ROUNDS = 2

# 2-4-2 layout, rows 45-54
_COL_LABEL = {
    'A': 'window seat on the left',
    'B': 'aisle seat on the left',
    'C': 'aisle seat in the centre block (left side)',
    'D': 'middle seat in the centre block',
    'E': 'middle seat in the centre block',
    'F': 'aisle seat in the centre block (right side)',
    'G': 'aisle seat on the right',
    'H': 'window seat on the right',
}


def _build_system_prompt(discount_seat_label, round_number, num_rounds):
    bridging = "Got it — one more coming up." if round_number < num_rounds else "That's it — thanks! Let's move on to a short survey."
    return f"""You are facilitating a seat discount question. Speak in English. Never speak more than 1 sentence per turn.

Ask ONCE: "Seat {discount_seat_label} is now ${_DISCOUNT_AMOUNT} cheaper — would you switch, or stick with your original choice, and why?" Then stop — the seat map will appear automatically. Wait silently for the participant to respond.
When they answer, call submit_page. Then say: "{bridging}" Say nothing else."""


class C(BaseConstants):
    NAME_IN_URL = 'seating_discount'
    PLAYERS_PER_GROUP = None
    NUM_ROUNDS = _NUM_ROUNDS


class Subsession(BaseSubsession):
    pass


class Group(BaseGroup):
    pass


class Player(BasePlayer):
    chat_log = models.LongStringField(blank=True)
    choice_pair = models.IntegerField(blank=True)
    original_choice = models.StringField(blank=True)
    discount_seat = models.StringField(blank=True)
    choice = models.StringField(blank=True)
    seat_map_shown = models.IntegerField(initial=0)
    screen_width = models.IntegerField(blank=True)
    screen_height = models.IntegerField(blank=True)
    touch_capable = models.IntegerField(initial=0)
    response_onset_ms = models.IntegerField(blank=True)
    response_duration_ms = models.IntegerField(blank=True)
    webrtc_stats = models.LongStringField(blank=True)
    time_on_page_ms = models.IntegerField(blank=True)
    user_agent = models.StringField(blank=True)


def creating_session(subsession):
    if subsession.round_number == 1:
        for player in subsession.get_players():
            all_pair_ids = [int(s['pair_id']) for s in _STIMULI]
            seed = int(hashlib.md5(player.participant.code.encode()).hexdigest(), 16)
            rng = random.Random(seed)
            discount_pairs = rng.sample(all_pair_ids, _NUM_ROUNDS)
            player.participant.vars['discount_pairs'] = discount_pairs


class Instructions(Page):
    @staticmethod
    def is_displayed(player: Player):
        return player.round_number == 1


class record(Page):
    form_model = 'player'
    form_fields = ['chat_log', 'choice', 'seat_map_shown', 'screen_width', 'screen_height',
                   'touch_capable', 'response_onset_ms', 'response_duration_ms',
                   'webrtc_stats', 'time_on_page_ms', 'user_agent']

    @staticmethod
    def vars_for_template(player: Player):
        pair_id = player.participant.vars['discount_pairs'][player.round_number - 1]
        stimulus = next(s for s in _STIMULI if int(s['pair_id']) == pair_id)
        seat_a = stimulus['seat_A']
        seat_b = stimulus['seat_B']

        original_choice = player.participant.vars.get('seating_choices_by_pair', {}).get(pair_id, 'seat_B')
        discount_seat = 'seat_B' if original_choice == 'seat_A' else 'seat_A'
        discount_seat_label = 'A' if discount_seat == 'seat_A' else 'B'

        player.choice_pair = pair_id
        player.original_choice = original_choice
        player.discount_seat = discount_seat

        return dict(
            seat_A=seat_a,
            seat_B=seat_b,
            discount_seat=discount_seat,
            discount_amount=_DISCOUNT_AMOUNT,
            discount_seat_label=discount_seat_label,
        )

    @staticmethod
    async def live_method(player: Player, data):
        msg_type = data.get('type', '')

        if msg_type == 'token':
            try:
                OPENAI_KEY = os.environ.get('WHISPER_KEY')
                pair_id = player.participant.vars['discount_pairs'][player.round_number - 1]
                original_choice = player.participant.vars.get('seating_choices_by_pair', {}).get(pair_id, 'seat_B')
                discount_seat = 'seat_B' if original_choice == 'seat_A' else 'seat_A'
                discount_seat_label = 'A' if discount_seat == 'seat_A' else 'B'
                system_prompt = _build_system_prompt(
                    discount_seat_label=discount_seat_label,
                    round_number=player.round_number,
                    num_rounds=C.NUM_ROUNDS,
                )

                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        'https://api.openai.com/v1/realtime/sessions',
                        headers={
                            'Authorization': f'Bearer {OPENAI_KEY}',
                            'Content-Type': 'application/json',
                        },
                        json={
                            'model': 'gpt-realtime-1.5',
                            'voice': 'cedar', # verse
                            'instructions': system_prompt,
                            'input_audio_transcription': {
                                'model': 'whisper-1',
                                'language': 'en',
                            },
                            'tools': [
                                {
                                    'type': 'function',
                                    'name': 'show_seat_map',
                                    'description': 'Displays the seat map with the discounted seat highlighted. Call this immediately after asking the question.',
                                    'parameters': {'type': 'object', 'properties': {}},
                                },
                            ],
                        },
                    )

                result = response.json()
                yield {player.id_in_group: {
                    'type': 'token',
                    'token': result.get('client_secret', {}).get('value', ''),
                    'model': 'gpt-realtime-1.5',
                }}

            except Exception as e:
                print(f"Error creating realtime session: {e}")
                yield {player.id_in_group: {
                    'type': 'error',
                    'message': 'Failed to create voice session.',
                }}

        elif msg_type == 'upload_url':
            try:
                filename = f"{player.session.code}_{player.participant.code}_discount_r{player.round_number}.webm"
                s3_client = boto3.client('s3',
                    aws_access_key_id=os.environ.get('S3_ACCESS_KEY'),
                    aws_secret_access_key=os.environ.get('S3_SECRET_KEY'),
                    region_name='eu-north-1',
                    config=BotoConfig(signature_version='s3v4'),
                )
                presigned_url = s3_client.generate_presigned_url(
                    'put_object',
                    Params={
                        'Bucket': 'ethz-otree-whisper',
                        'Key': filename,
                        'ContentType': 'audio/webm',
                    },
                    ExpiresIn=300,
                )
                yield {player.id_in_group: {
                    'type': 'upload_url',
                    'url': presigned_url,
                    'filename': filename,
                }}
            except Exception as e:
                print(f"[audio] Error generating presigned URL: {e}")
                yield {player.id_in_group: {
                    'type': 'error',
                    'message': 'Failed to generate upload URL.',
                }}

        elif msg_type == 'chat_log':
            player.chat_log = data.get('log', '')

    @staticmethod
    def before_next_page(player: Player, timeout_happened):
        if not player.choice:
            player.choice = 'None'
        player.participant.vars.setdefault('discount_choices', {})[player.choice_pair] = player.choice


page_sequence = [Instructions, record]
