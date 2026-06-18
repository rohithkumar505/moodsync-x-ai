import os
import urllib.request

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MUSIC_DIR = os.path.join(BASE_DIR, "music_files")

# Royalty-free SoundHelix demo tracks — hosted inside MoodSync only
TRACKS = {
    "happy_01.mp3": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    "happy_02.mp3": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    "happy_03.mp3": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    "happy_04.mp3": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
    "sad_01.mp3": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
    "sad_02.mp3": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3",
    "sad_03.mp3": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3",
    "angry_01.mp3": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
    "angry_02.mp3": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3",
    "angry_03.mp3": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3",
    "relaxed_01.mp3": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3",
    "relaxed_02.mp3": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3",
    "relaxed_03.mp3": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3",
    "neutral_01.mp3": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-14.mp3",
    "neutral_02.mp3": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3",
    "neutral_03.mp3": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3",
}


def download_tracks():
    os.makedirs(MUSIC_DIR, exist_ok=True)
    for filename, url in TRACKS.items():
        dest = os.path.join(MUSIC_DIR, filename)
        if os.path.exists(dest) and os.path.getsize(dest) > 10000:
            print(f"  skip {filename}")
            continue
        print(f"  download {filename}...")
        urllib.request.urlretrieve(url, dest)
    print(f"Music library ready in {MUSIC_DIR}")


if __name__ == "__main__":
    download_tracks()
