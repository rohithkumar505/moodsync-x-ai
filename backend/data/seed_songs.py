from models import MoodEnum, Song, db

# (song_name, artist, mood, language, movie, album)
SONGS_DATA = [
    ("Happy", "Pharrell Williams", MoodEnum.HAPPY, "English", "", "Happy"),
    ("Shape of You", "Ed Sheeran", MoodEnum.HAPPY, "English", "", "Divide"),
    ("Blinding Lights", "The Weeknd", MoodEnum.NEUTRAL, "English", "", "After Hours"),
    ("Someone Like You", "Adele", MoodEnum.SAD, "English", "", "21"),
    ("Perfect", "Ed Sheeran", MoodEnum.RELAXED, "English", "", "Divide"),

    ("Tum Hi Ho", "Arijit Singh", MoodEnum.SAD, "Hindi", "Aashiqui 2", "Aashiqui 2"),
    ("Kal Ho Naa Ho", "Sonu Nigam", MoodEnum.SAD, "Hindi", "Kal Ho Naa Ho", "Kal Ho Naa Ho"),
    ("Kesariya", "Arijit Singh", MoodEnum.NEUTRAL, "Hindi", "Brahmastra", "Brahmastra"),
    ("Apna Time Aayega", "Ranveer Singh", MoodEnum.HAPPY, "Hindi", "Gully Boy", "Gully Boy"),
    ("Balam Pichkari", "Vishal Dadlani", MoodEnum.HAPPY, "Hindi", "Yeh Jawaani Hai Deewani", "Yeh Jawaani Hai Deewani"),
    ("Channa Mereya", "Arijit Singh", MoodEnum.SAD, "Hindi", "Ae Dil Hai Mushkil", "Ae Dil Hai Mushkil"),
    ("Kabira", "Tochi Raina", MoodEnum.RELAXED, "Hindi", "Yeh Jawaani Hai Deewani", "Yeh Jawaani Hai Deewani"),
    ("Jhoome Jo Pathaan", "Vishal & Shekhar", MoodEnum.HAPPY, "Hindi", "Pathaan", "Pathaan"),
    ("Raabta", "Arijit Singh", MoodEnum.RELAXED, "Hindi", "Agent Vinod", "Agent Vinod"),
    ("Filhall", "B Praak", MoodEnum.SAD, "Punjabi", "Filhall", "Filhall"),

    ("Why This Kolaveri", "Dhanush", MoodEnum.HAPPY, "Tamil", "3", "3"),
    ("Rowdy Baby", "Dhanush", MoodEnum.HAPPY, "Tamil", "Maari 2", "Maari 2"),
    ("Inkem Inkem", "Sid Sriram", MoodEnum.SAD, "Telugu", "Geetha Govindam", "Geetha Govindam"),
    ("Butta Bomma", "Armaan Malik", MoodEnum.HAPPY, "Telugu", "Ala Vaikunthapurramuloo", "Ala Vaikunthapurramuloo"),
    ("Belageddu", "Vijay Prakash", MoodEnum.HAPPY, "Kannada", "Kirik Party", "Kirik Party"),
]


def _parse_row(row):
    name, artist, mood, language = row[:4]
    movie = row[4] if len(row) > 4 else ""
    album = row[5] if len(row) > 5 else movie or name
    return name, artist, mood, language, movie, album


def seed_songs():
    """Add starter catalog rows once — never mass-delete (avoids Postgres deadlocks)."""
    if Song.query.filter_by(source="local").count() >= len(SONGS_DATA):
        return

    existing = {
        (s.song_name.lower(), s.artist.lower())
        for s in Song.query.filter_by(source="local").all()
    }

    added = 0
    for row in SONGS_DATA:
        name, artist, mood, language, movie, album = _parse_row(row)
        key = (name.lower(), artist.lower())
        if key in existing:
            continue
        db.session.add(
            Song(
                song_name=name,
                artist=artist,
                mood=mood,
                language=language,
                movie=movie,
                album=album,
                source="local",
            )
        )
        added += 1

    if added:
        db.session.commit()
