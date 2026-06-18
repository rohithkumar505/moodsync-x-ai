import 'dart:async';

import 'package:camera/camera.dart';
import 'package:flutter/foundation.dart';
import 'package:permission_handler/permission_handler.dart';

class MoodCameraController {
  CameraController? _controller;
  List<CameraDescription> _cameras = [];

  CameraController? get controller => _controller;
  bool get isReady => _controller?.value.isInitialized ?? false;

  Future<String?> start() async {
    final cam = await Permission.camera.request();
    if (!cam.isGranted) return 'Camera permission denied';

    try {
      _cameras = await availableCameras();
      if (_cameras.isEmpty) return 'No camera found';

      final front = _cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.front,
        orElse: () => _cameras.first,
      );

      await _controller?.dispose();
      _controller = CameraController(front, ResolutionPreset.medium, enableAudio: false);
      await _controller!.initialize();
      return null;
    } catch (e) {
      return 'Could not start camera: $e';
    }
  }

  Future<Uint8List?> capture() async {
    final c = _controller;
    if (c == null || !c.value.isInitialized) return null;
    try {
      final file = await c.takePicture();
      return await file.readAsBytes();
    } catch (_) {
      return null;
    }
  }

  Future<void> dispose() async {
    await _controller?.dispose();
    _controller = null;
  }
}
