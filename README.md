# oTree Whisper API

This is an oTree app that integrates OpenAI's [Whisper API](https://openai.com/index/whisper/) for voice transcription in behavioral experiments. It is a fork of [clintmckenna/oTree-Whisper](https://github.com/clintmckenna/oTree-Whisper) with additional features for production use.

## Features

### Voice Recording & Transcription
- Floating pill-style recorder that stays at the bottom of the screen
- Record, re-record, and playback controls
- Real-time transcription via Whisper API
- Async live methods to prevent server blocking with multiple participants

### Consent Page
- GDPR-compliant consent flow
- Microphone permission request before the experiment begins
- Privacy policy integration

### Onboarding Tutorial
- Step-by-step walkthrough explaining the recorder interface
- Test recording with a sample phrase ("The cat is black")
- Audio quality verification before proceeding
- Transcript display to confirm recording works

### UI/UX
- Bootstrap placeholder animations while processing
- Responsive design for mobile devices
- Clean, modern interface

## Setup

### Requirements
Install the required packages:
```bash
pip install -r requirements.txt
```

### Environment Variables
You will need the following environment variables:

| Variable | Description |
|----------|-------------|
| `WHISPER_KEY` | OpenAI API key for Whisper transcription |
| `S3_ACCESS_KEY` | AWS access key for S3 storage (optional) |
| `S3_SECRET_KEY` | AWS secret key for S3 storage (optional) |

You can set these in a `.env` file in the project root.

### API Keys
- Get an OpenAI API key from [OpenAI's API](https://openai.com/product)
- If using Amazon S3 for audio storage, configure your AWS credentials

## File Structure

```
voice/
├── __init__.py          # Page classes and live methods
├── consent.html         # Consent and microphone permission
├── onboarding.html      # Tutorial and audio test
├── record.html          # Main recording page
├── privacy.html         # Privacy policy template
└── static/
    ├── css/
    │   ├── record.css       # Recorder styles
    │   └── onboarding.css   # Tutorial overlay styles
    └── js/
        ├── record.js        # Recording functionality
        └── onboarding.js    # Tutorial logic
```

## Citation

As part of oTree's [installation agreement](https://otree.readthedocs.io/en/master/install.html), please cite:

- Chen, D.L., Schonger, M., Wickens, C., 2016. oTree - An open-source platform for laboratory, online and field experiments. Journal of Behavioral and Experimental Finance, vol 9: 88-97.

For the original Whisper integration:

- McKenna, C., (2024). oTree Whisper. https://github.com/clintmckenna/oTree-Whisper
