# oTree Conversations

An oTree project for running behavioral experiments with conversational voice interfaces. Participants interact with an AI voice agent and their responses are recorded for analysis.

## Apps

| App | Description |
|-----|-------------|
| `onboarding` | GDPR-compliant consent flow and microphone test |
| `seating` | Voice-agent seat-preference survey (OpenAI Realtime API) |
| `seating_slider` | Post-conversation preference-strength slider follow-up |
| `chat` | General-purpose voice chat (OpenAI Realtime API) |
| `voice` | STT-based voice response (Whisper API) |
| `outro` | Post-experiment questionnaire |

## Setup

### Requirements
```bash
pip install -r requirements.txt
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `WHISPER_KEY` | OpenAI API key |
| `S3_ACCESS_KEY` | AWS access key for audio storage |
| `S3_SECRET_KEY` | AWS secret key for audio storage |
| `OTREE_ADMIN_PASSWORD` | oTree admin password |

Set these in a `.env` file in the project root for local development.

## Citation

Please cite oTree per its [installation agreement](https://otree.readthedocs.io/en/master/install.html):

> Chen, D.L., Schonger, M., Wickens, C., 2016. oTree — An open-source platform for laboratory, online and field experiments. *Journal of Behavioral and Experimental Finance*, 9: 88–97.

This project builds on [clintmckenna/oTree-Whisper](https://github.com/clintmckenna/oTree-Whisper):

> McKenna, C., 2024. oTree Whisper. https://github.com/clintmckenna/oTree-Whisper
