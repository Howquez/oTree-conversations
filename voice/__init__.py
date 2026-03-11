from otree.api import *
import boto3
import base64
import os
import httpx
import random
import pandas as pd
from dotenv import load_dotenv

load_dotenv()

doc = """
Voice transcription with Whisper API — CSV-driven multi-round product comparison
"""

# Load stimuli once at module level; NUM_ROUNDS is derived automatically
_STIMULI = (
    pd.read_csv('_static/global/stimuli.csv', sep=';')
    .apply(lambda col: col.str.strip() if col.dtype == 'object' else col)
    .to_dict('records')
)


class C(BaseConstants):
    NAME_IN_URL = 'voice'
    PLAYERS_PER_GROUP = None
    NUM_ROUNDS = len(_STIMULI)


class Subsession(BaseSubsession):
    pass


class Group(BaseGroup):
    pass


class Player(BasePlayer):
    base64 = models.LongStringField(blank=True)
    transcript = models.LongStringField(blank=True)
    choice_pair = models.IntegerField(blank=True)
    choice = models.StringField(blank=True)
    image_shown = models.IntegerField(initial=0)
    screen_width = models.IntegerField(blank=True)
    screen_height = models.IntegerField(blank=True)
    touch_capable = models.IntegerField(initial=0)


def creating_session(subsession):
    if subsession.round_number == 1:
        for player in subsession.get_players():
            choices = list(_STIMULI)
            rng = random.Random(player.participant.id_in_session)
            rng.shuffle(choices)
            player.participant.vars['choices'] = choices


# PAGES
class record(Page):
    form_model = 'player'
    form_fields = ['base64', 'image_shown', 'screen_width', 'screen_height', 'touch_capable']

    @staticmethod
    def vars_for_template(player: Player):
        current = player.participant.vars['choices'][player.round_number - 1]
        player.choice_pair = int(current['pair_id'])
        return dict(
            brand_A=current['brand_A'],
            product_A=current['product_A'],
            price_A=f"{float(current['price_A']):.2f}",
            pic_A=current['pic_A'],
            brand_B=current['brand_B'],
            product_B=current['product_B'],
            price_B=f"{float(current['price_B']):.2f}",
            pic_B=current['pic_B'],
        )

    @staticmethod
    async def live_method(player: Player, data):
        if 'text' in data:
            text = data['text']
            b64 = base64.b64decode(text)
            player.base64 = data['text']

            filename = f"{player.session.code}_{player.participant.code}_{player.round_number}.webm"
            print(filename)

            # S3 upload
            s3_client = boto3.client('s3',
                aws_access_key_id=os.environ.get('S3_ACCESS_KEY'),
                aws_secret_access_key=os.environ.get('S3_SECRET_KEY')
            )
            s3_client.put_object(
                Bucket='ethz-otree-whisper',
                Key=filename,
                Body=b64
            )

            output = {"text": ""}
            try:
                OPENAI_KEY = os.environ.get('WHISPER_KEY')
                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        'https://api.openai.com/v1/audio/transcriptions',
                        headers={'Authorization': f'Bearer {OPENAI_KEY}'},
                        files={"file": (filename, b64, "audio/webm")},
                        data={'model': 'whisper-1', 'language': 'en'}
                    )
                output = response.json()
                print(output['text'])
                player.transcript = output["text"]
            except Exception as e:
                print("error loading audio file:", e)

            yield {player.id_in_group: output}

    @staticmethod
    def before_next_page(player: Player, timeout_happened):
        if not player.transcript:
            player.choice = 'None'
            return

        current = player.participant.vars['choices'][player.round_number - 1]
        product_a = f"{current['brand_A']} {current['product_A']}"
        product_b = f"{current['brand_B']} {current['product_B']}"

        prompt = (
            f"I asked an English-speaking participant to choose between two products: "
            f"product_A called '{product_a}' and product_B called '{product_b}'. "
            f"A speech-to-text software transcribed their answer. "
            f"Based on the following transcript, which product did they choose? "
            f"Strictly respond with 'product_A' or 'product_B'. "
            f"If no choice can be determined, respond with 'None'.\n"
            f"Transcript: {player.transcript}"
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


page_sequence = [
    record,
]
