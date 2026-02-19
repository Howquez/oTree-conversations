from otree.api import *
import boto3
import base64
import os
import httpx
from dotenv import load_dotenv

load_dotenv()

doc = """
voice transcription with whisper api
"""


class C(BaseConstants):
    NAME_IN_URL = 'voice'
    PLAYERS_PER_GROUP = None
    NUM_ROUNDS = 1


class Subsession(BaseSubsession):
    pass

class Group(BaseGroup):
    pass


class Player(BasePlayer):
    base64 = models.LongStringField(blank=True)
    transcript = models.LongStringField(blank=True)
    image_shown = models.IntegerField(initial=0)
    screen_width = models.IntegerField(blank=True)
    screen_height = models.IntegerField(blank=True)
    touch_capable = models.IntegerField(initial=0)


# PAGES
class record(Page):
    form_model = 'player'
    form_fields = ['base64', 'image_shown', 'screen_width', 'screen_height', 'touch_capable']

    @staticmethod
    async def live_method(player: Player, data):

        # functions for retrieving text from openAI
        if 'text' in data:

            # grab base64 text and decode
            text = data['text']
            b64 = base64.b64decode(text)

            # save current base64 text
            player.base64 = data['text']

            # create filename format: (sessioncode)_(player id in group).webm
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

            # Whisper API functions
            output = {"text": ""}
            try:

                # openAI key (saved as environment variable)
                OPENAI_KEY = os.environ.get('WHISPER_KEY')

                # async request to Whisper API for transcription
                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        'https://api.openai.com/v1/audio/transcriptions',
                        headers={'Authorization': f'Bearer {OPENAI_KEY}'},
                        files={"file": (filename, b64, "audio/webm")},
                        data={'model': 'whisper-1'}
                    )

                # preview and write to player vars
                output = response.json()
                print(output['text'])
                player.transcript = output["text"]

            except Exception as e:
                print("error loading audio file:", e)

            yield {player.id_in_group: output}

page_sequence = [
    record,
]
