from otree.api import *
import boto3
from botocore.config import Config as BotoConfig
import os
import httpx
from dotenv import load_dotenv

load_dotenv()

doc = """
Voice chat bot using OpenAI Realtime API
"""


class C(BaseConstants):
    NAME_IN_URL = 'chat'
    PLAYERS_PER_GROUP = None
    NUM_ROUNDS = 1
    SYSTEM_PROMPT = """You are a friendly conversational assistant conducting a short survey. Speak in English.

Follow this conversation flow:
1. Start by greeting the user warmly and asking how their day is going.
2. Ask one casual smalltalk question (e.g., about the weather, their weekend plans, or something light).
3. After the smalltalk, transition by briefly explaining what comes next — something like "Great, now I'd like to get your opinion on something" or "Thanks for sharing! So the reason I'm here today is to get your take on a quick product comparison." Do NOT mention specific products or prices yet. Wait for the user to acknowledge.
4. Once the user responds to the transition, call the show_product_comparison function to display the products. Then ask whether they prefer Diet Coke or Coke Zero, mentioning that Diet Coke costs $1.50 and Coke Zero costs $2.00.
5. After they answer, thank them for their response and tell them to click on the blue button to proceed.

Keep your responses short and conversational. Don't be robotic - be natural and friendly."""


class Subsession(BaseSubsession):
    pass

class Group(BaseGroup):
    pass


class Player(BasePlayer):
    chat_log = models.LongStringField(blank=True)
    image_shown = models.IntegerField(initial=0)
    screen_width = models.IntegerField(blank=True)
    screen_height = models.IntegerField(blank=True)
    touch_capable = models.IntegerField(initial=0)


# PAGES
class record(Page):
    form_model = 'player'
    form_fields = ['chat_log', 'image_shown', 'screen_width', 'screen_height', 'touch_capable']

    @staticmethod
    async def live_method(player: Player, data):
        msg_type = data.get('type', '')

        if msg_type == 'token':
            # Request ephemeral token from OpenAI for WebRTC connection
            try:
                OPENAI_KEY = os.environ.get('WHISPER_KEY')

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
                            'instructions': C.SYSTEM_PROMPT,
                            'input_audio_transcription': {
                                'model': 'whisper-1',
                                'language': 'en',
                            },
                            'tools': [
                                {
                                    'type': 'function',
                                    'name': 'show_product_comparison',
                                    'description': 'Displays the product comparison card showing Diet Coke and Coke Zero side by side. Call this before asking the user about their preference.',
                                    'parameters': {
                                        'type': 'object',
                                        'properties': {},
                                    },
                                },
                            ],
                        },
                    )

                result = response.json()
                print(f"Realtime session created: {result.get('id', 'unknown')}")

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
            # Generate a presigned S3 upload URL for the frontend
            try:
                filename = f"{player.session.code}_{player.participant.code}_chat.webm"
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
                print(f"[audio] Presigned URL generated for: {filename}")
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
            # Save chat log from frontend
            player.chat_log = data.get('log', '')
            print(f"Chat log saved for player {player.id_in_group}")


page_sequence = [
    record,
]
