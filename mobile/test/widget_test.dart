import 'package:flutter_test/flutter_test.dart';
import 'package:moodsync_mobile/data/mood_constants.dart';

void main() {
  test('mood constants include five moods', () {
    expect(MoodConstants.moods.length, 5);
    expect(MoodConstants.emoji['HAPPY'], '😊');
  });
}
