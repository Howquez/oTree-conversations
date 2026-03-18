# oTree Conversations

An oTree project for running behavioral experiments with conversational voice interfaces. Participants interact with an AI voice agent and their responses are recorded for analysis.

## Apps

| App | Description |
|-----|-------------|
| `onboarding` | GDPR-compliant consent flow and microphone test |
| `seating` | Voice-agent seat-preference survey — 6 pairs, OpenAI Realtime API |
| `seating_discount` | Voice-agent discount follow-up — 2 previously unchosen seats offered at $25 off |
| `seating_slider` | Slider rating of preference strength for the 6 seating pairs |
| `seating_discount_slider` | Slider rating of preference strength for the 2 discount pairs |
| `outro` | Post-experiment questionnaire with optional voice feedback (OTF) |

### Session configurations

| Config | App sequence |
|--------|-------------|
| `seat_preference` | onboarding → seating → seating_discount → seating_slider → seating_discount_slider → outro |
| `seat_preference_short` | onboarding → seating → seating_discount → outro |

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
