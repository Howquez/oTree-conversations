# Pre-Registration: Vocal Paralinguistic Cues and Preference Strength in a Conversational Seat-Selection Interface

> **Pilot study.** This study is explicitly designed as a pilot. We have no prior experience deploying conversational voice interfaces in a survey setting and therefore deliberately retain some analytical degrees of freedom (marked **[pilot d.f.]** throughout). These are not arbitrary; they reflect genuine uncertainty about data quality and appropriate modelling choices that we expect to resolve before running a confirmatory study.

---

## 1. Research Question

We will examine whether preference strength estimated by a pretrained XGBoost model from extracted vocal paralinguistic cues is positively associated with self-reported preference strength.

---

## 2. Background

We designed a conversational voice interface in which study participants interact with an AI voice agent to complete a seat-selection task. The agent is powered by OpenAI's Realtime API (`gpt-4o-realtime-preview`). Because we have no prior experience with such conversational interfaces in a study setting, we run this study as a pilot. Accordingly, we deliberately retain some degrees of freedom in the analysis.

---

## 3. Experimental Design

### 3.1 Task

Each participant completes six seat-choice decisions. Each decision presents two airplane seat options drawn from the following fixed set of pairs (presented in randomised order):

| Pair | Seat A | Seat B |
|------|--------|--------|
| 1 | 47A | 47G |
| 2 | 47D | 52C |
| 3 | 48D | 48E |
| 4 | 47F | 52C |
| 5 | 46B | 53E |
| 6 | 48B | 49G |

The aircraft cabin layout is 2–4–2 (columns A–B / C–D–E–F / G–H), rows 45–54. Row 45 is an exit row with extra legroom located adjacent to the lavatories.

The presentation order of the six pairs is fully randomised across participants using each participant's Prolific ID as the random seed, ensuring reproducibility.

### 3.2 Voice interaction

Participants interact with the voice agent using their microphone. In the first round, the agent greets the participant, asks two brief small-talk questions, displays a visual seat map, and asks the participant to state their preference. From the second round onwards, the seat map is displayed automatically and the agent waits silently for the participant to say "A" or "B". Once a clear preference is stated, the agent advances to the next round. Participants cannot revise their stated choice.

### 3.3 Preference strength measure

After completing all six voice rounds, participants are shown the same six seat pairs again in the same order. For each pair, they respond to the item "How much did you prefer one seat over the other?" using a slider anchored at −50 (*I strongly preferred Seat A*), 0 (*No preference*), and +50 (*I strongly preferred Seat B*). The slider handle is hidden until the participant first interacts with it to avoid anchoring on the midpoint. Participants must move the slider before they can proceed.

### 3.4 Post-task questionnaire

After all slider rounds, participants complete a questionnaire covering:
- Interface quality (7 items, 1–7 Likert, randomly ordered)
- Perceived realism and adoption intent (2 items, 1–7 Likert, randomly ordered with interface quality items)
- Interaction quality / turn-taking (3 items, 1–7 Likert)
- Naturalness of expression (1 item, 1–7 Likert)
- Familiarity with voice-activated technologies (1 item, 1–7 Likert)
- Situational covariates (location, voice disguise)
- Demographics (age, gender, household income)
- Open-ended feedback

---

## 4. Data Collection and Storage

The study is implemented in oTree (Chen, Schonger, and Wickens 2016) and deployed on a Heroku server. Each voice interaction is recorded as a stereo `.webm` file (Opus codec): the left channel contains the participant's microphone input and the right channel contains the agent's audio output. Recordings are uploaded directly to a private Amazon S3 bucket (`ethz-otree-whisper`, region `eu-north-1`) via a presigned URL and are never stored on the oTree server. One recording is generated per round per participant (six recordings total).

In addition, the full conversation transcript (including both participant and agent turns) is saved as a JSON array in the oTree database.

---

## 5. Pre-processing

### 5.1 Transcript-based choice coding

Each participant's stated seat choice (A or B) is extracted automatically from the conversation transcript using OpenAI's `gpt-4o-mini` model at the end of each round. If no choice can be determined from the transcript, the choice is coded as `None`.

### 5.2 Audio feature extraction

Vocal paralinguistic features will be extracted from the participant's channel (left) of each `.webm` recording. Our primary tool is the voiceR package. **[pilot d.f.]** We may additionally consider feature extraction with librosa, openSMILE, or pretrained embedding models such as wav2vec 2.0. The choice of tool will be guided by data quality assessments conducted prior to the primary analysis.

### 5.3 Response segmentation

We define *response onset* as the timestamp of the first detected speech in the participant's channel following the agent's question. We define *response duration* as the total duration of participant speech within the recording. **[pilot d.f.]** The precise segmentation method (e.g., energy-based VAD vs. model-based VAD) will be determined after inspecting a random sample of recordings.

---

## 6. Primary Analysis

1. We will apply a pretrained XGBoost model to the extracted vocal paralinguistic features to estimate, for each response, the probability that it reflects high preference strength.

2. We will test whether this model-predicted probability is positively associated with the participant's self-reported preference strength (slider, −50 to +50) using a mixed-effects linear regression model with random intercepts per participant and fixed slopes. This accounts for baseline differences in how participants use their voice and the slider.

3. As robustness checks, we will re-estimate the model using participant fixed effects and simple OLS.

**Hypothesis:** The coefficient on model-predicted preference strength probability will be positive and statistically significant (α = 0.05, two-tailed).

---

## 7. Secondary Analysis

We will re-estimate the primary mixed-effects model with the addition of response onset time and response duration as covariates, to assess whether timing features alone account for the association. **[pilot d.f.]** The operationalisation of these variables is subject to the segmentation decisions described in Section 5.3.

---

## 8. Population and Recruitment

Participants will be recruited via Prolific and must meet the following eligibility criteria at the point of invitation:

- Approval rate ≥ 99 %
- First language: English
- Current country of residence: USA or Canada
- Prolific profile attribute *Record Audio*: Yes

Prolific study settings:
- Devices: Desktop only
- Study requirements: Audio

---

## 9. Sample Size

We will recruit 100 participants.

---

## 10. Exclusion Criteria

- Participants who do not complete the full study are excluded.
- Participants for whom fewer than six audio recordings are retrievable from S3 are excluded.
- Participants for whom fewer than six recordings are judged to be of sufficient quality for feature extraction (e.g., due to excessive background noise or near-zero signal level) are excluded. **[pilot d.f.]** The threshold for "sufficient quality" will be defined after inspecting the distribution of signal-to-noise ratios in the collected data, prior to running the primary analysis.
- Participants whose stated choices are coded as `None` for more than one of the six rounds are excluded.

---

## 11. References

Chen, Daniel L., Martin Schonger, and Chris Wickens. 2016. "oTree—An Open-Source Platform for Laboratory, Online, and Field Experiments." *Journal of Behavioral and Experimental Finance* 9: 88–97. https://doi.org/10.1016/j.jbef.2015.12.001
