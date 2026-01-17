# Phase 7: Revolutionary Features - Mobile Implementation

**Purpose:** Mobile-specific implementation guide for Phase 7 revolutionary features
**Target Audience:** Mobile Developers, iOS/Android Engineers, UX Designers
**Last Updated:** 2025-12-30

## Table of Contents

1. [Mobile Strategy Overview](#mobile-strategy-overview)
2. [Mobile AR Implementation](#mobile-ar-implementation)
3. [Voice Commands on Mobile](#voice-commands-on-mobile)
4. [Mobile App Builder Preview](#mobile-app-builder-preview)
5. [Wearable Integration](#wearable-integration)
6. [Offline Capabilities](#offline-capabilities)
7. [Performance Optimization](#performance-optimization)
8. [Platform-Specific Features](#platform-specific-features)

---

## Mobile Strategy Overview

### Mobile-First Revolutionary Features

Phase 7 revolutionary features are designed with mobile as the primary interface for field workers:

```
Desktop Use Cases          Mobile Use Cases
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Planning & Analysis    →   Field Execution
Report Generation      →   Real-time Data Capture
App Building           →   AR-Guided Maintenance
Data Review            →   Voice Work Orders
Configuration          →   Digital Twin Monitoring
```

### Supported Platforms

| Platform | AR Support | Voice Support | Target Version |
|----------|-----------|---------------|----------------|
| iOS | ARKit 4.0+ | Yes (Siri + Web Speech) | iOS 14+ |
| Android | ARCore 1.20+ | Yes (Web Speech API) | Android 9+ |
| PWA | WebXR (limited) | Yes | Modern browsers |
| Tablets | Full support | Yes | All platforms |

---

## Mobile AR Implementation

### ARKit Implementation (iOS)

#### Setup ARKit Session

```swift
// ARAssetViewer.swift

import ARKit
import SceneKit

class ARAssetViewer: UIViewController, ARSCNViewDelegate {

    @IBOutlet var sceneView: ARSCNView!
    var assetNode: SCNNode?
    var infoPanel: UIView?

    override func viewDidLoad() {
        super.viewDidLoad()

        // Set up scene view
        sceneView.delegate = self
        sceneView.showsStatistics = true

        // Enable plane detection
        let configuration = ARWorldTrackingConfiguration()
        configuration.planeDetection = [.horizontal, .vertical]
        configuration.environmentTexturing = .automatic

        // Start AR session
        sceneView.session.run(configuration)
    }

    // MARK: - QR Code Detection

    func detectQRCode(in frame: ARFrame) {
        let ciImage = CIImage(cvPixelBuffer: frame.capturedImage)
        let detector = CIDetector(
            ofType: CIDetectorTypeQRCode,
            context: nil,
            options: [CIDetectorAccuracy: CIDetectorAccuracyHigh]
        )

        guard let features = detector?.features(in: ciImage) as? [CIQRCodeFeature] else {
            return
        }

        for feature in features {
            if let assetId = feature.messageString {
                loadAssetInfo(assetId: assetId)
            }
        }
    }

    // MARK: - Asset Info Overlay

    func loadAssetInfo(assetId: String) {
        // Fetch asset data from API
        APIService.shared.getAsset(id: assetId) { [weak self] result in
            switch result {
            case .success(let asset):
                DispatchQueue.main.async {
                    self?.displayAssetOverlay(asset: asset)
                }
            case .failure(let error):
                print("Error loading asset: \(error)")
            }
        }
    }

    func displayAssetOverlay(asset: Asset) {
        // Create info panel
        let panelWidth: CGFloat = 300
        let panelHeight: CGFloat = 200

        let panel = UIView(frame: CGRect(
            x: (view.bounds.width - panelWidth) / 2,
            y: 100,
            width: panelWidth,
            height: panelHeight
        ))

        panel.backgroundColor = UIColor(white: 0.1, alpha: 0.9)
        panel.layer.cornerRadius = 12
        panel.layer.borderWidth = 2
        panel.layer.borderColor = UIColor.systemBlue.cgColor

        // Add asset information
        let titleLabel = UILabel(frame: CGRect(x: 16, y: 16, width: panelWidth - 32, height: 30))
        titleLabel.text = asset.id
        titleLabel.textColor = .white
        titleLabel.font = .systemFont(ofSize: 20, weight: .bold)
        panel.addSubview(titleLabel)

        let statusLabel = createStatusLabel(
            status: asset.status,
            frame: CGRect(x: 16, y: 54, width: panelWidth - 32, height: 24)
        )
        panel.addSubview(statusLabel)

        // Temperature
        if let temperature = asset.temperature {
            let tempLabel = createDataLabel(
                title: "Temperature:",
                value: "\(temperature)°C",
                y: 86
            )
            panel.addSubview(tempLabel)
        }

        // Vibration
        if let vibration = asset.vibration {
            let vibLabel = createDataLabel(
                title: "Vibration:",
                value: "\(vibration) mm/s",
                y: 114
            )
            panel.addSubview(vibLabel)
        }

        // Add to view
        view.addSubview(panel)
        infoPanel = panel

        // Animate appearance
        panel.alpha = 0
        panel.transform = CGAffineTransform(scaleX: 0.8, y: 0.8)
        UIView.animate(withDuration: 0.3) {
            panel.alpha = 1
            panel.transform = .identity
        }
    }

    func createStatusLabel(status: String, frame: CGRect) -> UILabel {
        let label = UILabel(frame: frame)
        label.textColor = .white
        label.font = .systemFont(ofSize: 16, weight: .medium)

        let statusColor: UIColor
        switch status.lowercased() {
        case "operational":
            statusColor = .systemGreen
            label.text = "● OPERATIONAL"
        case "warning":
            statusColor = .systemYellow
            label.text = "⚠️ WARNING"
        case "critical":
            statusColor = .systemRed
            label.text = "⛔ CRITICAL"
        default:
            statusColor = .systemGray
            label.text = "● \(status.uppercased())"
        }

        label.textColor = statusColor
        return label
    }

    func createDataLabel(title: String, value: String, y: CGFloat) -> UIView {
        let container = UIView(frame: CGRect(x: 16, y: y, width: 268, height: 20))

        let titleLabel = UILabel(frame: CGRect(x: 0, y: 0, width: 120, height: 20))
        titleLabel.text = title
        titleLabel.textColor = UIColor(white: 0.7, alpha: 1)
        titleLabel.font = .systemFont(ofSize: 14)
        container.addSubview(titleLabel)

        let valueLabel = UILabel(frame: CGRect(x: 120, y: 0, width: 148, height: 20))
        valueLabel.text = value
        valueLabel.textColor = .white
        valueLabel.font = .systemFont(ofSize: 14, weight: .semibold)
        valueLabel.textAlignment = .right
        container.addSubview(valueLabel)

        return container
    }

    // MARK: - 3D Model Placement

    func place3DModel(for asset: Asset, at position: SCNVector3) {
        // Load 3D model
        guard let modelURL = Bundle.main.url(forResource: asset.modelName, withExtension: "usdz") else {
            print("Model not found")
            return
        }

        do {
            let scene = try SCNScene(url: modelURL, options: nil)

            if let modelNode = scene.rootNode.childNodes.first {
                modelNode.position = position
                modelNode.scale = SCNVector3(0.01, 0.01, 0.01) // Scale down

                // Add to scene
                sceneView.scene.rootNode.addChildNode(modelNode)
                assetNode = modelNode

                // Add animation
                let rotateAction = SCNAction.rotateBy(
                    x: 0,
                    y: CGFloat.pi * 2,
                    z: 0,
                    duration: 10
                )
                modelNode.runAction(SCNAction.repeatForever(rotateAction))
            }
        } catch {
            print("Error loading 3D model: \(error)")
        }
    }

    // MARK: - ARSCNViewDelegate

    func renderer(_ renderer: SCNSceneRenderer, updateAtTime time: TimeInterval) {
        // Update QR detection every frame
        guard let frame = sceneView.session.currentFrame else { return }
        detectQRCode(in: frame)
    }
}
```

### ARCore Implementation (Android)

#### Setup ARCore Session

```kotlin
// ARAssetViewerActivity.kt

import com.google.ar.core.*
import com.google.ar.sceneform.ArSceneView
import com.google.ar.sceneform.rendering.ModelRenderable
import com.google.ar.sceneform.ux.ArFragment
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity

class ARAssetViewerActivity : AppCompatActivity() {

    private lateinit var arFragment: ArFragment
    private lateinit var sceneView: ArSceneView
    private var assetModel: ModelRenderable? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_ar_viewer)

        arFragment = supportFragmentManager.findFragmentById(R.id.ar_fragment) as ArFragment
        sceneView = arFragment.arSceneView

        // Configure AR session
        val config = Config(arFragment.arSceneView.session).apply {
            updateMode = Config.UpdateMode.LATEST_CAMERA_IMAGE
            planeFindingMode = Config.PlaneFindingMode.HORIZONTAL_AND_VERTICAL
        }

        arFragment.arSceneView.session?.configure(config)

        // Set up QR code detection
        setupQRDetection()

        // Load 3D model
        load3DModel()
    }

    private fun setupQRDetection() {
        sceneView.scene.addOnUpdateListener { frameTime ->
            val frame = arFragment.arSceneView.arFrame ?: return@addOnUpdateListener

            // Get camera image
            val image = frame.acquireCameraImage()

            // Detect QR codes
            detectQRCode(image)

            image.close()
        }
    }

    private fun detectQRCode(image: Image) {
        // Use ML Kit or ZXing for QR detection
        val detector = BarcodeDetector.Builder(this)
            .setBarcodeFormats(Barcode.QR_CODE)
            .build()

        // Convert AR image to bitmap
        val bitmap = imageToBitmap(image)
        val frame = Frame.Builder().setBitmap(bitmap).build()

        val barcodes = detector.detect(frame)

        for (i in 0 until barcodes.size()) {
            val barcode = barcodes.valueAt(i)
            val assetId = barcode.rawValue

            if (assetId != null) {
                loadAssetInfo(assetId)
            }
        }
    }

    private fun loadAssetInfo(assetId: String) {
        // Fetch asset from API
        apiService.getAsset(assetId).enqueue(object : Callback<Asset> {
            override fun onResponse(call: Call<Asset>, response: Response<Asset>) {
                if (response.isSuccessful) {
                    response.body()?.let { asset ->
                        displayAssetOverlay(asset)
                    }
                }
            }

            override fun onFailure(call: Call<Asset>, t: Throwable) {
                Log.e("AR", "Error loading asset", t)
            }
        })
    }

    private fun displayAssetOverlay(asset: Asset) {
        runOnUiThread {
            // Create overlay view
            val overlay = layoutInflater.inflate(R.layout.asset_overlay, null)

            // Populate with asset data
            overlay.findViewById<TextView>(R.id.asset_id).text = asset.id
            overlay.findViewById<TextView>(R.id.asset_status).apply {
                text = asset.status
                setTextColor(getStatusColor(asset.status))
            }

            asset.temperature?.let {
                overlay.findViewById<TextView>(R.id.temperature).text = "$it°C"
            }

            asset.vibration?.let {
                overlay.findViewById<TextView>(R.id.vibration).text = "$it mm/s"
            }

            // Add to scene
            val overlayLayout = findViewById<FrameLayout>(R.id.overlay_container)
            overlayLayout.removeAllViews()
            overlayLayout.addView(overlay)

            // Animate appearance
            overlay.alpha = 0f
            overlay.scaleX = 0.8f
            overlay.scaleY = 0.8f
            overlay.animate()
                .alpha(1f)
                .scaleX(1f)
                .scaleY(1f)
                .setDuration(300)
                .start()
        }
    }

    private fun load3DModel() {
        ModelRenderable.builder()
            .setSource(this, R.raw.pump_model)
            .build()
            .thenAccept { renderable ->
                assetModel = renderable
            }
            .exceptionally { throwable ->
                Log.e("AR", "Unable to load model", throwable)
                null
            }
    }

    private fun place3DModel(hitResult: HitResult) {
        val anchor = hitResult.createAnchor()
        val anchorNode = AnchorNode(anchor)
        anchorNode.setParent(sceneView.scene)

        assetModel?.let { model ->
            val modelNode = TransformableNode(arFragment.transformationSystem)
            modelNode.setParent(anchorNode)
            modelNode.renderable = model
            modelNode.select()
        }
    }

    private fun getStatusColor(status: String): Int {
        return when (status.toLowerCase()) {
            "operational" -> Color.GREEN
            "warning" -> Color.YELLOW
            "critical" -> Color.RED
            else -> Color.GRAY
        }
    }
}
```

### WebXR Implementation (Progressive Web App)

```typescript
// src/mobile/WebXRViewer.tsx

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface WebXRViewerProps {
  assetId: string;
}

export const WebXRViewer: React.FC<WebXRViewerProps> = ({ assetId }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [xrSupported, setXrSupported] = useState(false);
  const [xrSession, setXrSession] = useState<XRSession | null>(null);

  useEffect(() => {
    checkXRSupport();
  }, []);

  const checkXRSupport = async () => {
    if ('xr' in navigator) {
      const supported = await (navigator as any).xr.isSessionSupported('immersive-ar');
      setXrSupported(supported);
    }
  };

  const startAR = async () => {
    if (!('xr' in navigator)) {
      alert('WebXR not supported');
      return;
    }

    try {
      const session = await (navigator as any).xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test', 'dom-overlay'],
        domOverlay: { root: containerRef.current }
      });

      setXrSession(session);
      initializeXRSession(session);
    } catch (error) {
      console.error('Error starting AR:', error);
    }
  };

  const initializeXRSession = (session: XRSession) => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl', { xrCompatible: true });

    if (!gl) {
      console.error('WebGL not supported');
      return;
    }

    const renderer = new THREE.WebGLRenderer({
      canvas,
      context: gl as WebGLRenderingContext,
      alpha: true
    });
    renderer.xr.enabled = true;
    renderer.xr.setSession(session);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

    // Add lighting
    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    scene.add(light);

    // Load asset info
    loadAssetInfo(assetId, scene);

    // Render loop
    renderer.setAnimationLoop((time, frame) => {
      if (frame) {
        const referenceSpace = renderer.xr.getReferenceSpace();
        const pose = frame.getViewerPose(referenceSpace!);

        if (pose) {
          renderer.render(scene, camera);
        }
      }
    });

    session.addEventListener('end', () => {
      setXrSession(null);
      renderer.setAnimationLoop(null);
    });
  };

  const loadAssetInfo = async (assetId: string, scene: THREE.Scene) => {
    // Fetch asset data
    const response = await fetch(`/api/assets/${assetId}`);
    const asset = await response.json();

    // Create info panel (3D text/sprites)
    createInfoPanel(asset, scene);
  };

  const createInfoPanel = (asset: any, scene: THREE.Scene) => {
    // Create canvas for text
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = 512;
    canvas.height = 256;

    // Draw background
    context.fillStyle = 'rgba(26, 26, 26, 0.9)';
    context.fillRect(0, 0, 512, 256);

    // Draw text
    context.fillStyle = '#00d4ff';
    context.font = 'Bold 32px Arial';
    context.fillText(asset.id, 20, 50);

    context.fillStyle = '#ffffff';
    context.font = '24px Arial';
    context.fillText(`Status: ${asset.status}`, 20, 90);
    context.fillText(`Temp: ${asset.temperature}°C`, 20, 130);
    context.fillText(`Vibration: ${asset.vibration} mm/s`, 20, 170);

    // Create texture and material
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true
    });

    // Create mesh
    const geometry = new THREE.PlaneGeometry(1, 0.5);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, 1.5, -2);

    scene.add(mesh);
  };

  return (
    <div ref={containerRef} className="webxr-viewer">
      {xrSupported ? (
        <button onClick={startAR} className="hw-btn hw-btn-primary">
          Start AR Experience
        </button>
      ) : (
        <div className="not-supported">
          <p>AR not supported on this device</p>
          <p>Please use a device with ARCore (Android) or ARKit (iOS)</p>
        </div>
      )}
    </div>
  );
};
```

---

## Voice Commands on Mobile

### iOS Speech Recognition

```swift
// VoiceCommandManager.swift

import Speech
import AVFoundation

class VoiceCommandManager: NSObject, SFSpeechRecognizerDelegate {

    private let speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private let audioEngine = AVAudioEngine()

    var onCommandRecognized: ((String) -> Void)?
    var isListening = false

    override init() {
        super.init()
        speechRecognizer?.delegate = self
        requestAuthorization()
    }

    func requestAuthorization() {
        SFSpeechRecognizer.requestAuthorization { authStatus in
            DispatchQueue.main.async {
                switch authStatus {
                case .authorized:
                    print("Speech recognition authorized")
                case .denied, .restricted, .notDetermined:
                    print("Speech recognition not authorized")
                @unknown default:
                    break
                }
            }
        }
    }

    func startListening() throws {
        // Cancel previous task
        recognitionTask?.cancel()
        recognitionTask = nil

        // Configure audio session
        let audioSession = AVAudioSession.sharedInstance()
        try audioSession.setCategory(.record, mode: .measurement, options: .duckOthers)
        try audioSession.setActive(true, options: .notifyOthersOnDeactivation)

        // Create recognition request
        recognitionRequest = SFSpeechAudioBufferRecognitionRequest()

        guard let recognitionRequest = recognitionRequest else {
            throw NSError(domain: "VoiceCommandManager", code: 1, userInfo: nil)
        }

        recognitionRequest.shouldReportPartialResults = true

        // Configure audio input
        let inputNode = audioEngine.inputNode
        let recordingFormat = inputNode.outputFormat(forBus: 0)

        inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { buffer, _ in
            recognitionRequest.append(buffer)
        }

        audioEngine.prepare()
        try audioEngine.start()

        // Start recognition
        recognitionTask = speechRecognizer?.recognitionTask(with: recognitionRequest) { [weak self] result, error in
            guard let self = self else { return }

            var isFinal = false

            if let result = result {
                let transcript = result.bestTranscription.formattedString

                // Check for wake word
                if transcript.lowercased().contains("hey ava") {
                    self.processCommand(transcript)
                }

                isFinal = result.isFinal
            }

            if error != nil || isFinal {
                self.audioEngine.stop()
                inputNode.removeTap(onBus: 0)

                self.recognitionRequest = nil
                self.recognitionTask = nil
            }
        }

        isListening = true
    }

    func stopListening() {
        audioEngine.stop()
        recognitionRequest?.endAudio()
        isListening = false
    }

    private func processCommand(_ transcript: String) {
        // Remove wake word
        let command = transcript.lowercased().replacingOccurrences(of: "hey ava", with: "").trimmingCharacters(in: .whitespaces)

        // Provide haptic feedback
        let generator = UIImpactFeedbackGenerator(style: .medium)
        generator.impactOccurred()

        // Play acknowledgment sound
        AudioServicesPlaySystemSound(1057)

        // Send to command processor
        onCommandRecognized?(command)
    }
}

// Usage in ViewController
class VoiceViewController: UIViewController {

    let voiceManager = VoiceCommandManager()

    override func viewDidLoad() {
        super.viewDidLoad()

        voiceManager.onCommandRecognized = { [weak self] command in
            self?.executeCommand(command)
        }
    }

    @IBAction func voiceButtonTapped(_ sender: UIButton) {
        if voiceManager.isListening {
            voiceManager.stopListening()
            sender.backgroundColor = .systemBlue
        } else {
            do {
                try voiceManager.startListening()
                sender.backgroundColor = .systemGreen
            } catch {
                print("Error starting voice recognition: \(error)")
            }
        }
    }

    func executeCommand(_ command: String) {
        // Parse and execute command
        APIService.shared.processVoiceCommand(command) { result in
            switch result {
            case .success(let response):
                self.handleCommandResponse(response)
            case .failure(let error):
                print("Command failed: \(error)")
            }
        }
    }
}
```

### Android Speech Recognition

```kotlin
// VoiceCommandManager.kt

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.os.Vibrator

class VoiceCommandManager(private val context: Context) : RecognitionListener {

    private val speechRecognizer: SpeechRecognizer = SpeechRecognizer.createSpeechRecognizer(context)
    private val vibrator: Vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator

    var onCommandRecognized: ((String) -> Unit)? = null
    var isListening = false

    init {
        speechRecognizer.setRecognitionListener(this)
    }

    fun startListening() {
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-US")
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
        }

        speechRecognizer.startListening(intent)
        isListening = true
    }

    fun stopListening() {
        speechRecognizer.stopListening()
        isListening = false
    }

    override fun onResults(results: Bundle?) {
        val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)

        matches?.firstOrNull()?.let { transcript ->
            if (transcript.toLowerCase().contains("hey ava")) {
                processCommand(transcript)
            }
        }
    }

    override fun onPartialResults(results: Bundle?) {
        val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)

        matches?.firstOrNull()?.let { transcript ->
            if (transcript.toLowerCase().contains("hey ava")) {
                // Provide haptic feedback
                vibrator.vibrate(50)
            }
        }
    }

    private fun processCommand(transcript: String) {
        // Remove wake word
        val command = transcript.toLowerCase()
            .replace("hey ava", "")
            .trim()

        // Vibrate to confirm
        vibrator.vibrate(50)

        // Send to callback
        onCommandRecognized?.invoke(command)
    }

    override fun onReadyForSpeech(params: Bundle?) {}
    override fun onBeginningOfSpeech() {}
    override fun onRmsChanged(rmsdB: Float) {}
    override fun onBufferReceived(buffer: ByteArray?) {}
    override fun onEndOfSpeech() {}
    override fun onError(error: Int) {
        isListening = false
    }
    override fun onEvent(eventType: Int, params: Bundle?) {}
}

// Usage in Activity
class VoiceActivity : AppCompatActivity() {

    private lateinit var voiceManager: VoiceCommandManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_voice)

        voiceManager = VoiceCommandManager(this)
        voiceManager.onCommandRecognized = { command ->
            executeCommand(command)
        }

        findViewById<FloatingActionButton>(R.id.voice_button).setOnClickListener {
            toggleVoiceListening()
        }
    }

    private fun toggleVoiceListening() {
        if (voiceManager.isListening) {
            voiceManager.stopListening()
        } else {
            voiceManager.startListening()
        }
    }

    private fun executeCommand(command: String) {
        apiService.processVoiceCommand(command).enqueue(object : Callback<CommandResponse> {
            override fun onResponse(call: Call<CommandResponse>, response: Response<CommandResponse>) {
                if (response.isSuccessful) {
                    response.body()?.let { handleCommandResponse(it) }
                }
            }

            override fun onFailure(call: Call<CommandResponse>, t: Throwable) {
                Log.e("Voice", "Command failed", t)
            }
        })
    }
}
```

---

## Mobile App Builder Preview

### React Native App Preview Component

```typescript
// src/mobile/AppPreview.tsx

import React from 'react';
import { View, Text, TextInput, Button, ScrollView, StyleSheet } from 'react-native';

interface AppPreviewProps {
  appDefinition: any;
}

export const AppPreview: React.FC<AppPreviewProps> = ({ appDefinition }) => {
  const renderComponent = (component: any) => {
    switch (component.type) {
      case 'Input':
        return (
          <View key={component.id} style={styles.inputContainer}>
            <Text style={styles.label}>{component.props.label}</Text>
            <TextInput
              style={styles.input}
              placeholder={component.props.placeholder}
            />
          </View>
        );

      case 'Button':
        return (
          <Button
            key={component.id}
            title={component.props.text}
            onPress={() => console.log('Button pressed')}
          />
        );

      case 'Table':
        return (
          <View key={component.id} style={styles.tableContainer}>
            <Text style={styles.tableTitle}>Data Table</Text>
            {/* Render table rows */}
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.appTitle}>{appDefinition.name}</Text>
      {appDefinition.components.map(renderComponent)}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  appTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    marginBottom: 4,
    color: '#666',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  tableContainer: {
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
  },
  tableTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
});
```

---

## Wearable Integration

### Apple Watch Integration

```swift
// WatchAssetMonitor.swift

import WatchKit
import Foundation

class AssetMonitorController: WKInterfaceController {

    @IBOutlet weak var assetLabel: WKInterfaceLabel!
    @IBOutlet weak var statusLabel: WKInterfaceLabel!
    @IBOutlet weak var temperatureLabel: WKInterfaceLabel!
    @IBOutlet weak var vibrationLabel: WKInterfaceLabel!

    var assetId: String = "PUMP-001"
    var timer: Timer?

    override func awake(withContext context: Any?) {
        super.awake(withContext: context)

        if let assetId = context as? String {
            self.assetId = assetId
        }

        updateAssetInfo()
        startMonitoring()
    }

    func startMonitoring() {
        timer = Timer.scheduledTimer(withTimeInterval: 5.0, repeats: true) { [weak self] _ in
            self?.updateAssetInfo()
        }
    }

    func updateAssetInfo() {
        APIService.shared.getAsset(id: assetId) { [weak self] result in
            switch result {
            case .success(let asset):
                DispatchQueue.main.async {
                    self?.displayAsset(asset)
                }
            case .failure(let error):
                print("Error: \(error)")
            }
        }
    }

    func displayAsset(_ asset: Asset) {
        assetLabel.setText(asset.id)

        // Status with color
        statusLabel.setText(asset.status)
        switch asset.status.lowercased() {
        case "operational":
            statusLabel.setTextColor(.green)
        case "warning":
            statusLabel.setTextColor(.yellow)
        case "critical":
            statusLabel.setTextColor(.red)
            sendCriticalNotification(for: asset)
        default:
            statusLabel.setTextColor(.gray)
        }

        // Sensor data
        if let temp = asset.temperature {
            temperatureLabel.setText("\(temp)°C")
        }

        if let vib = asset.vibration {
            vibrationLabel.setText("\(vib) mm/s")
        }
    }

    func sendCriticalNotification(for asset: Asset) {
        // Send local notification
        let content = UNMutableNotificationContent()
        content.title = "Critical Alert"
        content.body = "\(asset.id) requires immediate attention"
        content.sound = .defaultCritical

        let request = UNNotificationRequest(
            identifier: "critical-\(asset.id)",
            content: content,
            trigger: nil
        )

        UNUserNotificationCenter.current().add(request)

        // Haptic feedback
        WKInterfaceDevice.current().play(.notification)
    }

    @IBAction func voiceButtonTapped() {
        // Trigger Siri shortcut
        presentTextInputController(
            withSuggestions: ["Create work order", "View history", "Get status"],
            allowedInputMode: .plain
        ) { [weak self] results in
            guard let command = results?.first as? String else { return }
            self?.processVoiceCommand(command)
        }
    }

    func processVoiceCommand(_ command: String) {
        APIService.shared.processVoiceCommand(command) { result in
            // Handle response
        }
    }
}
```

---

## Offline Capabilities

### Service Worker for PWA

```typescript
// public/service-worker.js

const CACHE_NAME = 'hubblewave-v7-offline';
const urlsToCache = [
  '/',
  '/static/js/main.js',
  '/static/css/main.css',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
];

// Install service worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

// Fetch with network-first strategy for API calls
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/')) {
    // Network first, fallback to cache
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Clone and cache successful responses
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Network failed, try cache
          return caches.match(event.request);
        })
    );
  } else {
    // Cache first for static assets
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
    );
  }
});

// Background sync for offline work orders
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-workorders') {
    event.waitUntil(syncWorkOrders());
  }
});

async function syncWorkOrders() {
  const db = await openIndexedDB();
  const pendingWorkOrders = await db.getAll('pending-workorders');

  for (const wo of pendingWorkOrders) {
    try {
      await fetch('/api/work-orders', {
        method: 'POST',
        body: JSON.stringify(wo),
        headers: { 'Content-Type': 'application/json' },
      });

      // Remove from pending after successful sync
      await db.delete('pending-workorders', wo.id);
    } catch (error) {
      console.error('Sync failed:', error);
    }
  }
}
```

---

## Performance Optimization

### Mobile-Specific Optimizations

```typescript
// src/mobile/optimization.ts

// 1. Lazy load heavy components
const ARViewer = lazy(() => import('./ARViewer'));
const DigitalTwinViewer = lazy(() => import('./DigitalTwinViewer'));

// 2. Image optimization
export const optimizeImage = (url: string, width: number): string => {
  return `${url}?w=${width}&q=80&fm=webp`;
};

// 3. Debounce voice recognition
export const debouncedVoiceProcess = debounce(
  async (transcript: string) => {
    await processVoiceCommand(transcript);
  },
  300
);

// 4. Virtual scrolling for long lists
export const VirtualAssetList: React.FC = () => {
  return (
    <FixedSizeList
      height={window.innerHeight}
      itemCount={assets.length}
      itemSize={80}
      width="100%"
    >
      {AssetRow}
    </FixedSizeList>
  );
};

// 5. Request batching
class RequestBatcher {
  private queue: any[] = [];
  private timeout: NodeJS.Timeout | null = null;

  add(request: any) {
    this.queue.push(request);

    if (!this.timeout) {
      this.timeout = setTimeout(() => this.flush(), 100);
    }
  }

  flush() {
    if (this.queue.length > 0) {
      fetch('/api/batch', {
        method: 'POST',
        body: JSON.stringify({ requests: this.queue }),
      });

      this.queue = [];
      this.timeout = null;
    }
  }
}

// 6. Memory management
export const cleanup3DModels = (scene: THREE.Scene) => {
  scene.traverse((object) => {
    if ((object as THREE.Mesh).isMesh) {
      const mesh = object as THREE.Mesh;
      mesh.geometry.dispose();

      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((material) => material.dispose());
      } else {
        mesh.material.dispose();
      }
    }
  });
};
```

---

## Platform-Specific Features

### iOS-Specific Features

- **Haptic Feedback:** Utilize UIImpactFeedbackGenerator for voice commands
- **Siri Shortcuts:** Create custom shortcuts for common actions
- **ARKit Exclusive:** LiDAR scanner support for precise AR placement
- **Widget Extension:** Home screen widget showing asset status
- **Apple Watch:** Quick glance asset monitoring

### Android-Specific Features

- **Material Design 3:** Native Android UI components
- **Widgets:** Home screen widgets with asset status
- **Wear OS:** Smartwatch notifications and quick actions
- **ARCore Geospatial:** Location-based AR overlays
- **Edge-to-Edge Display:** Immersive AR experience

---

## Document Control

- **Version:** 1.0
- **Last Updated:** 2025-12-30
- **Owner:** HubbleWave Mobile Team
- **Review Cycle:** Weekly
- **Related Documents:**
  - 01-IMPLEMENTATION-GUIDE.md
  - 02-UI-SPECIFICATIONS.md
