class MoodConstants {
  static const moods = ['HAPPY', 'SAD', 'ANGRY', 'RELAXED', 'NEUTRAL'];
  static const languages = ['English', 'Hindi', 'Tamil', 'Telugu', 'Punjabi', 'Kannada'];

  static const emoji = {
    'HAPPY': '😊',
    'SAD': '😔',
    'ANGRY': '😡',
    'RELAXED': '😌',
    'NEUTRAL': '😐',
  };

  static String label(String mood) =>
      mood.isEmpty ? mood : mood[0] + mood.substring(1).toLowerCase();
}
