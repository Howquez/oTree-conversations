from otree.api import *
import base64
import os
import httpx
from dotenv import load_dotenv

load_dotenv()

doc = """
Consent and onboarding for voice recording studies
"""


class C(BaseConstants):
    NAME_IN_URL = 'onboarding'
    PLAYERS_PER_GROUP = None
    NUM_ROUNDS = 1
    PRIVACY_TEMPLATE = "onboarding/privacy.html"


class Subsession(BaseSubsession):
    pass


class Group(BaseGroup):
    pass


class Player(BasePlayer):
    pass


# PAGES
class consent(Page):
    form_model = 'player'


class onboarding(Page):
    form_model = 'player'

    @staticmethod
    async def live_method(player: Player, data):
        # Transcribe test recording (no S3 upload for onboarding)
        if 'audio' in data:
            audio_data = data['audio']
            b64 = base64.b64decode(audio_data)

            output = {"text": ""}
            try:
                OPENAI_KEY = os.environ.get('WHISPER_KEY')

                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        'https://api.openai.com/v1/audio/transcriptions',
                        headers={'Authorization': f'Bearer {OPENAI_KEY}'},
                        files={"file": ("test.webm", b64, "audio/webm")},
                        data={'model': 'whisper-1'}
                    )

                output = response.json()
                print(f"Onboarding transcript: {output.get('text', '')}")

            except Exception as e:
                print("Error transcribing onboarding audio:", e)

            yield {player.id_in_group: output}


page_sequence = [
    consent,
    onboarding,
]
