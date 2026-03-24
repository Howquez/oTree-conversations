from otree.api import *
import boto3
from botocore.config import Config as BotoConfig
import os
import httpx
import itertools
import random
import hashlib
import pandas as pd
from dotenv import load_dotenv

load_dotenv()

doc = """
Voice chat bot using OpenAI Realtime API — between-subjects design (free vs. scripted response)
"""

_STIMULI = (
    pd.read_csv('_static/global/stimuli_seating.csv', sep=';')
    .apply(lambda col: col.str.strip() if col.dtype == 'object' else col)
    .to_dict('records')
)

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

_SCRIPT = "either 'Please book Option A for me' or 'Please book Option B for me'"


def _describe_seat(seat_id):
    row = int(seat_id[:-1])
    col = seat_id[-1].upper()
    parts = [f"seat {seat_id}", f"row {row}", _COL_LABEL.get(col, col)]
    if row == 45:
        parts.append("exit row with extra legroom, located next to the bathroom")
    return ', '.join(parts)


def _build_system_prompt(seat_a, seat_b, round_number, num_rounds, condition):
    if round_number == 1:
        if condition == 'scripted':
            step4 = f'Ask ONCE which seat they\'d like and specify the exact response format, e.g. "Which seat would you like? Please respond by saying {_SCRIPT}." Do not repeat this question.'
            step5 = f'When they answer, call submit_page. Then say two sentences only, e.g. "For the next rounds I\'ll show you a new pair of seats. Please respond by saying {_SCRIPT}." Stop.'
        else:
            step4 = 'Ask ONCE: "Which of these two seats would you like?" or a natural variation, e.g. "Which one would you like me to book?" Do not repeat this question.'
            step5 = 'When they answer, call submit_page. Then say two sentences only, e.g. "For the next rounds I\'ll show you a new pair of seats — just say which one you\'d like to book. Please speak in a full sentence." Stop.'
        return f"""You are a friendly voice assistant helping a passenger select their seat. Speak in English. Never speak more than 3 sentences in a single turn.

Follow these steps strictly in order:
1. Greet the user in one sentence only.
2. Give a SHORT introduction. Then ask ONE brief warm-up question, e.g. "I'll be helping you pick your seat today — have you flown this route before?" Wait for their answer. Follow up in one sentence only. Then transition to the seat selection.
3. Call show_seat_map immediately — say nothing before or after until the tool completes.
4. {step4}
5. {step5}"""
    elif round_number < num_rounds:
        return f"""You are a voice assistant helping a passenger select their seat. This is round {round_number} of {num_rounds}. Speak in English. Never speak more than 1 sentence per turn.

Ask ONCE which seat they'd like — vary the phrasing naturally each round, e.g. "Which of these two would you like?", "Which seat would you like me to book?", "Which one would you go with?" Then stop — the seat map will appear automatically. Wait silently for the participant to respond.
When they answer, call submit_page. Say one short sentence only, e.g. "Got it." Say nothing else."""
    else:
        return f"""You are a voice assistant helping a passenger select their seat. This is the final round. Speak in English. Never speak more than 1 sentence per turn.

Ask ONCE which seat they'd like — vary the phrasing naturally, e.g. "Which of these two would you like?", "Which seat would you like me to book?", "Which one would you go with?" Then stop — the seat map will appear automatically. Wait silently for the participant to respond.
When they answer, call submit_page. Say one short closing sentence only, e.g. "That's the last one — thanks!" Say nothing else."""


class C(BaseConstants):
    NAME_IN_URL = 'seating_between'
    PLAYERS_PER_GROUP = None
    NUM_ROUNDS = len(_STIMULI)


class Subsession(BaseSubsession):
    pass


class Group(BaseGroup):
    pass


class Player(BasePlayer):
    condition = models.StringField()
    chat_log = models.LongStringField(blank=True)
    choice_pair = models.IntegerField(blank=True)
    choice = models.StringField(blank=True)
    seat_map_shown = models.IntegerField(initial=0)
    screen_width = models.IntegerField(blank=True)
    screen_height = models.IntegerField(blank=True)
    touch_capable = models.IntegerField(initial=0)
    # Paradata
    response_onset_ms = models.IntegerField(blank=True)
    response_duration_ms = models.IntegerField(blank=True)
    webrtc_stats = models.LongStringField(blank=True)
    time_on_page_ms = models.IntegerField(blank=True)
    user_agent = models.StringField(blank=True)


def creating_session(subsession):
    if subsession.round_number == 1:
        players = subsession.get_players()
        conditions = itertools.cycle(['free', 'scripted'])
        for player, condition in zip(players, conditions):
            player.participant.vars['condition'] = condition
            choices = list(_STIMULI)
            seed = int(hashlib.md5(player.participant.code.encode()).hexdigest(), 16)
            rng = random.Random(seed)
            rng.shuffle(choices)
            player.participant.vars['choices'] = choices


class Instructions(Page):
    @staticmethod
    def is_displayed(player: Player):
        return player.round_number == 1

    @staticmethod
    def vars_for_template(player: Player):
        return dict(condition=player.participant.vars.get('condition', 'free'))


class record(Page):
    form_model = 'player'
    form_fields = ['chat_log', 'choice', 'seat_map_shown', 'screen_width', 'screen_height', 'touch_capable',
                   'response_onset_ms', 'response_duration_ms', 'webrtc_stats', 'time_on_page_ms', 'user_agent']

    @staticmethod
    def vars_for_template(player: Player):
        current = player.participant.vars['choices'][player.round_number - 1]
        player.choice_pair = int(current['pair_id'])
        condition = player.participant.vars.get('condition', 'free')
        player.condition = condition
        return dict(
            seat_A=current['seat_A'],
            seat_B=current['seat_B'],
            condition=condition,
        )

    @staticmethod
    async def live_method(player: Player, data):
        msg_type = data.get('type', '')

        if msg_type == 'token':
            try:
                OPENAI_KEY = os.environ.get('WHISPER_KEY')
                current = player.participant.vars['choices'][player.round_number - 1]
                condition = player.participant.vars.get('condition', 'free')
                system_prompt = _build_system_prompt(
                    seat_a=current['seat_A'],
                    seat_b=current['seat_B'],
                    round_number=player.round_number,
                    num_rounds=C.NUM_ROUNDS,
                    condition=condition,
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
                            'voice': 'cedar',
                            'instructions': system_prompt,
                            'input_audio_transcription': {
                                'model': 'whisper-1',
                                'language': 'en',
                            },
                            'tools': [
                                {
                                    'type': 'function',
                                    'name': 'show_seat_map',
                                    'description': 'Displays the seat map highlighting the two seats being compared. Call this before asking the user about their preference.',
                                    'parameters': {
                                        'type': 'object',
                                        'properties': {},
                                    },
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
                condition = player.participant.vars.get('condition', 'free')
                filename = f"{player.session.code}_{player.participant.code}_seating_between_{condition}_r{player.round_number}.webm"
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
        player.participant.vars.setdefault('seating_choices', {})[player.round_number] = player.choice
        player.participant.vars.setdefault('seating_choices_by_pair', {})[player.choice_pair] = player.choice


page_sequence = [Instructions, record]
