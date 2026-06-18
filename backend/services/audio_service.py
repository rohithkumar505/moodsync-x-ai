import os

from config import BASE_DIR

MUSIC_DIR = os.path.join(BASE_DIR, "music_files")

MOOD_AUDIO_FILES = {
    "HAPPY": ["happy_01.mp3", "happy_02.mp3", "happy_03.mp3", "happy_04.mp3"],
    "SAD": ["sad_01.mp3", "sad_02.mp3", "sad_03.mp3"],
    "ANGRY": ["angry_01.mp3", "angry_02.mp3", "angry_03.mp3"],
    "RELAXED": ["relaxed_01.mp3", "relaxed_02.mp3", "relaxed_03.mp3"],
    "NEUTRAL": ["neutral_01.mp3", "neutral_02.mp3", "neutral_03.mp3"],
}


def get_music_dir():
    return MUSIC_DIR


def resolve_audio_path(audio_file):
    if not audio_file:
        return None
    safe = os.path.basename(audio_file)
    path = os.path.join(MUSIC_DIR, safe)
    if os.path.isfile(path):
        return path
    return None


def pick_audio_for_mood(mood_value, index):
    files = MOOD_AUDIO_FILES.get(mood_value, MOOD_AUDIO_FILES["NEUTRAL"])
    return files[index % len(files)]
