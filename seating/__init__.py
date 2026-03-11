from otree.api import *
import boto3
from botocore.config import Config as BotoConfig
import os
import httpx
import random
import pandas as pd
from dotenv import load_dotenv

load_dotenv()

doc = """
Voice chat bot using OpenAI Realtime API — CSV-driven multi-round seat preference survey
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


def _describe_seat(seat_id):
    row = int(seat_id[:-1])
    col = seat_id[-1].upper()
    parts = [f"seat {seat_id}", f"row {row}", _COL_LABEL.get(col, col)]
    if row == 45:
        parts.append("exit row with extra legroom, located next to the bathroom")
    return ', '.join(parts)


def _build_system_prompt(seat_a, seat_b, round_number, num_rounds):
    if round_number == 1:
        return f"""You are a friendly assistant running a short airline seat survey. Speak in English.

Follow these steps strictly in order:
1. Greet the user warmly (one sentence).
2. Ask TWO casual small-talk questions, e.g. about their day or travel plans. STOP and wait for their answer.
3. After they answer, say one short transition (e.g. "Great! Let me show you two seat options.") and call show_seat_map. Do NOT ask about the seats yet — wait for the tool to complete.
4. After the tool completes, ask ONCE: "Would you prefer Seat A or Seat B?" Do not repeat this question.
5. When they answer clearly, call submit_page. Then say one sentence explaining the remaining rounds, e.g. "For the next rounds you'll see two seats on screen each time — just say out loud whether you prefer A or B and we'll move straight on." Then stop."""
    elif round_number < num_rounds:
        return f"""You are facilitating round {round_number} of {num_rounds} of a seat survey. Speak in English.

The seat map is already on screen. Say nothing — wait silently for the participant to say A or B.
When they answer clearly, call submit_page. Then say one short sentence bridging to the next round, e.g. "Got it — next pair coming up." Say nothing else."""
    else:
        return f"""You are facilitating the final round of a seat survey. Speak in English.

The seat map is already on screen. Say nothing — wait for the participant to say A or B.
When they answer clearly, call submit_page. Then say one short closing line, e.g. "That's the last one — thanks!" Say nothing else."""


class C(BaseConstants):
    NAME_IN_URL = 'seating'
    PLAYERS_PER_GROUP = None
    NUM_ROUNDS = len(_STIMULI)


class Subsession(BaseSubsession):
    pass


class Group(BaseGroup):
    pass


class Player(BasePlayer):
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
        for player in subsession.get_players():
            choices = list(_STIMULI)
            rng = random.Random(player.participant.id_in_session)
            rng.shuffle(choices)
            player.participant.vars['choices'] = choices


class Instructions(Page):
    @staticmethod
    def is_displayed(player: Player):
        return player.round_number == 1


class record(Page):
    form_model = 'player'
    form_fields = ['chat_log', 'seat_map_shown', 'screen_width', 'screen_height', 'touch_capable',
                   'response_onset_ms', 'response_duration_ms', 'webrtc_stats', 'time_on_page_ms', 'user_agent']

    @staticmethod
    def vars_for_template(player: Player):
        current = player.participant.vars['choices'][player.round_number - 1]
        player.choice_pair = int(current['pair_id'])
        return dict(
            seat_A=current['seat_A'],
            seat_B=current['seat_B'],
        )

    @staticmethod
    async def live_method(player: Player, data):
        msg_type = data.get('type', '')

        if msg_type == 'token':
            try:
                OPENAI_KEY = os.environ.get('WHISPER_KEY')
                current = player.participant.vars['choices'][player.round_number - 1]
                system_prompt = _build_system_prompt(
                    seat_a=current['seat_A'],
                    seat_b=current['seat_B'],
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
                            'model': 'gpt-4o-realtime-preview',
                            'voice': 'verse',
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
                    'model': 'gpt-4o-realtime-preview',
                }}

            except Exception as e:
                print(f"Error creating realtime session: {e}")
                yield {player.id_in_group: {
                    'type': 'error',
                    'message': 'Failed to create voice session.',
                }}

        elif msg_type == 'upload_url':
            try:
                filename = f"{player.session.code}_{player.participant.code}_seating_r{player.round_number}.webm"
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
        if not player.chat_log:
            player.choice = 'None'
            return

        current = player.participant.vars['choices'][player.round_number - 1]
        seat_a = current['seat_A']
        seat_b = current['seat_B']

        prompt = (
            f"I asked a participant to choose between two airplane seats: "
            f"seat_A called '{seat_a}' and seat_B called '{seat_b}'. "
            f"The following is a JSON transcript of the voice conversation. "
            f"Based on the conversation, which seat did the participant choose? "
            f"Strictly respond with 'seat_A' or 'seat_B'. "
            f"If no choice can be determined, respond with 'None'.\n"
            f"Conversation: {player.chat_log}"
        )

        try:
            OPENAI_KEY = os.environ.get('WHISPER_KEY')
            with httpx.Client() as client:
                response = client.post(
                    'https://api.openai.com/v1/chat/completions',
                    headers={
                        'Authorization': f'Bearer {OPENAI_KEY}',
                        'Content-Type': 'application/json',
                    },
                    json={
                        'model': 'gpt-4o-mini',
                        'messages': [{'role': 'user', 'content': prompt}],
                        'max_tokens': 10,
                    }
                )
            player.choice = response.json()['choices'][0]['message']['content'].strip()
        except Exception as e:
            print(f"Choice classification error: {e}")
            player.choice = 'None'


page_sequence = [Instructions, record]
