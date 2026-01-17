# Phase 8: Mobile Implementation - Native Excellence

**Version:** 1.0
**Last Updated:** 2025-12-30
**Status:** Production Mobile Apps

## Overview

Comprehensive guide for implementing native-quality mobile applications using Capacitor/Ionic, including App Store deployment, native feature integration, and offline-first architecture.

## Table of Contents

1. [Capacitor/Ionic Wrapper](#capacitorionic-wrapper)
2. [App Store Optimization](#app-store-optimization)
3. [Deep Linking](#deep-linking)
4. [Native Feature Integration](#native-feature-integration)
5. [Offline-First Architecture](#offline-first-architecture)
6. [Performance Optimization](#performance-optimization)
7. [App Store Deployment](#app-store-deployment)

---

## Capacitor/Ionic Wrapper

### Setup and Configuration

#### Install Capacitor

```bash
# Install Capacitor
npm install @capacitor/core @capacitor/cli

# Install platform-specific packages
npm install @capacitor/ios @capacitor/android

# Install Ionic Native plugins
npm install @ionic-native/core
npm install @ionic/storage-angular
```

#### Initialize Capacitor

```bash
# Initialize Capacitor project
npx cap init

# Prompts:
# App name: HubbleWave
# App ID: com.hubblewave.app
# Web asset directory: dist/hubblewave (Angular build output)
```

#### capacitor.config.ts

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hubblewave.app',
  appName: 'HubbleWave',
  webDir: 'dist/hubblewave',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    hostname: 'app.hubblewave.com',
    // For development
    // url: 'http://localhost:4200',
    // cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#2952ff',
      showSpinner: false,
      androidSpinnerStyle: 'small',
      iosSpinnerStyle: 'small',
      spinnerColor: '#ffffff',
    },
    StatusBar: {
      style: 'light',
      backgroundColor: '#2952ff',
    },
    Keyboard: {
      resize: 'body',
      style: 'dark',
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
  ios: {
    contentInset: 'always',
    scheme: 'HubbleWave',
  },
  android: {
    buildOptions: {
      keystorePath: './android/release.keystore',
      keystoreAlias: 'hubblewave',
      releaseType: 'APK',
    },
  },
};

export default config;
```

### Add Platforms

```bash
# Add iOS platform
npx cap add ios

# Add Android platform
npx cap add android

# Open in native IDEs
npx cap open ios      # Opens Xcode
npx cap open android  # Opens Android Studio
```

---

## App Store Optimization

### iOS App Store

#### App Information

```yaml
App Name: HubbleWave
Subtitle: Project Management with AI
Bundle ID: com.hubblewave.app
SKU: HUBBLEWAVE-001
Category:
  Primary: Productivity
  Secondary: Business

Pricing:
  Model: Free with in-app purchases
  Subscriptions:
    - Free (0-2 users)
    - Pro ($12/user/month)
    - Enterprise (Custom pricing)

Age Rating: 4+

Description:
  Headline: |
    Work smarter with AI-powered project management

  Full Description: |
    HubbleWave is the modern project management platform that helps
    teams collaborate effortlessly. Powered by AVA, your intelligent
    AI assistant, HubbleWave makes organizing work simple and fun.

    KEY FEATURES:
    • AI Assistant (AVA) - Get help, insights, and automation
    • Real-time Collaboration - See changes instantly
    • Offline Mode - Work anywhere, sync when online
    • Beautiful Design - Intuitive and easy to use
    • Unlimited Projects - No limits on your creativity
    • Mobile & Web - Access from any device

    PERFECT FOR:
    • Startups building products
    • Teams coordinating work
    • Individuals staying organized
    • Agencies managing clients

    WHY HUBBLEWAVE:
    ✓ 4x faster than competitors
    ✓ Works offline completely
    ✓ AI included at no extra cost
    ✓ Bank-grade security
    ✓ 99.9% uptime guarantee

    Download now and transform how you work!

Keywords:
  - project management
  - task manager
  - collaboration
  - team productivity
  - AI assistant
  - workflow automation
  - project planning
  - agile
  - scrum
  - kanban
```

#### Screenshots (Required Sizes)

```yaml
iPhone 6.7" (iPhone 14 Pro Max):
  - Home Dashboard (showing AVA)
  - Project View (task list)
  - Task Detail (with comments)
  - Analytics Dashboard
  - Settings Screen

iPhone 6.5" (iPhone 11 Pro Max):
  - Same as above

iPhone 5.5" (iPhone 8 Plus):
  - Same as above

iPad Pro 12.9" (2nd/3rd gen):
  - Split view (projects + tasks)
  - Calendar view
  - Dashboard with widgets
  - Team collaboration

iPad Pro 12.9" (6th gen):
  - Same as above
```

#### App Preview Videos

```yaml
Duration: 15-30 seconds each

Video 1: "Meet AVA" (30s)
  - Open app
  - Ask AVA "What's due today?"
  - AVA shows tasks
  - Complete a task with voice
  - Celebrate!

Video 2: "Collaborate" (20s)
  - Open shared project
  - See real-time updates
  - Add comment
  - @mention teammate
  - Get instant notification

Video 3: "Work Offline" (15s)
  - Go offline (airplane mode)
  - Create tasks
  - Edit project
  - Go online
  - Watch sync happen
```

### Android Play Store

#### Store Listing

```yaml
App Name: HubbleWave - AI Project Manager
Short Description: |
  Smart project management with AI. Collaborate, organize, achieve.

Full Description: |
  [Same as iOS, optimized for 4000 char limit]

Category: Productivity
Content Rating: Everyone

Graphics:
  Feature Graphic: 1024 x 500 px
  Icon: 512 x 512 px (transparent background)
  Screenshots:
    - Phone: 16:9 or 9:16 ratio
    - Tablet 7": 16:9 or 9:16
    - Tablet 10": 16:9 or 9:16

Promo Video: YouTube URL (same as iOS preview)

Contact Info:
  Website: https://hubblewave.com
  Email: support@hubblewave.com
  Phone: +1-555-HUBBLE-1
  Privacy Policy: https://hubblewave.com/privacy
```

---

## Deep Linking

### Universal Links (iOS)

#### apple-app-site-association

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAM_ID.com.hubblewave.app",
        "paths": [
          "/app/*",
          "/projects/*",
          "/tasks/*",
          "/invite/*"
        ]
      }
    ]
  },
  "webcredentials": {
    "apps": ["TEAM_ID.com.hubblewave.app"]
  }
}
```

Host at: `https://hubblewave.com/.well-known/apple-app-site-association`

#### iOS Implementation

```swift
// ios/App/App/AppDelegate.swift
import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    func application(
        _ application: UIApplication,
        continue userActivity: NSUserActivity,
        restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
    ) -> Bool {
        if userActivity.activityType == NSUserActivityTypeBrowsingWeb {
            if let url = userActivity.webpageURL {
                // Handle deep link
                NotificationCenter.default.post(
                    name: NSNotification.Name("DeepLink"),
                    object: url
                )
            }
        }
        return true
    }
}
```

### App Links (Android)

#### AndroidManifest.xml

```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<manifest>
  <application>
    <activity
      android:name=".MainActivity"
      android:launchMode="singleTask">

      <!-- Deep Link Intent Filter -->
      <intent-filter android:autoVerify="true">
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />

        <data
          android:scheme="https"
          android:host="hubblewave.com"
          android:pathPrefix="/app" />
        <data
          android:scheme="https"
          android:host="hubblewave.com"
          android:pathPrefix="/projects" />
        <data
          android:scheme="https"
          android:host="hubblewave.com"
          android:pathPrefix="/tasks" />
        <data
          android:scheme="https"
          android:host="hubblewave.com"
          android:pathPrefix="/invite" />
      </intent-filter>

      <!-- Custom Scheme -->
      <intent-filter>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />

        <data android:scheme="hubblewave" />
      </intent-filter>
    </activity>
  </application>
</manifest>
```

#### assetlinks.json

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.hubblewave.app",
      "sha256_cert_fingerprints": [
        "SHA256_FINGERPRINT_HERE"
      ]
    }
  }
]
```

Host at: `https://hubblewave.com/.well-known/assetlinks.json`

### Deep Link Handler (Angular)

```typescript
// src/app/services/deep-link.service.ts
import { Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { App, URLOpenListenerEvent } from '@capacitor/app';

@Injectable({ providedIn: 'root' })
export class DeepLinkService {
  constructor(
    private router: Router,
    private zone: NgZone
  ) {}

  initialize(): void {
    App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
      this.zone.run(() => {
        const url = new URL(event.url);
        const path = url.pathname;

        // Parse and route
        if (path.startsWith('/projects/')) {
          const projectId = path.split('/')[2];
          this.router.navigate(['/app/projects', projectId]);
        } else if (path.startsWith('/tasks/')) {
          const taskId = path.split('/')[2];
          this.router.navigate(['/app/tasks', taskId]);
        } else if (path.startsWith('/invite/')) {
          const inviteCode = path.split('/')[2];
          this.router.navigate(['/app/invite', inviteCode]);
        } else {
          // Default to app home
          this.router.navigate(['/app/dashboard']);
        }
      });
    });
  }

  /**
   * Generate shareable deep link
   */
  createDeepLink(type: 'project' | 'task', id: string): string {
    return `https://hubblewave.com/${type}s/${id}`;
  }
}
```

---

## Native Feature Integration

### Biometric Authentication

```typescript
// src/app/services/biometric-auth.service.ts
import { Injectable } from '@angular/core';
import { NativeBiometric, BiometryType } from 'capacitor-native-biometric';

@Injectable({ providedIn: 'root' })
export class BiometricAuthService {
  async isBiometricAvailable(): Promise<boolean> {
    try {
      const result = await NativeBiometric.isAvailable();
      return result.isAvailable;
    } catch {
      return false;
    }
  }

  async getBiometricType(): Promise<BiometryType> {
    const result = await NativeBiometric.isAvailable();
    return result.biometryType;
  }

  async authenticate(reason: string = 'Login to HubbleWave'): Promise<boolean> {
    try {
      await NativeBiometric.verifyIdentity({
        reason,
        title: 'Authentication Required',
        subtitle: 'Please verify your identity',
        description: 'Use biometric to access your account',
      });
      return true;
    } catch (error) {
      console.error('Biometric auth failed:', error);
      return false;
    }
  }

  async saveCredentials(username: string, password: string): Promise<void> {
    await NativeBiometric.setCredentials({
      username,
      password,
      server: 'hubblewave.com',
    });
  }

  async getCredentials(): Promise<{ username: string; password: string } | null> {
    try {
      const credentials = await NativeBiometric.getCredentials({
        server: 'hubblewave.com',
      });
      return credentials;
    } catch {
      return null;
    }
  }

  async deleteCredentials(): Promise<void> {
    await NativeBiometric.deleteCredentials({
      server: 'hubblewave.com',
    });
  }
}
```

### Camera Integration

```typescript
// src/app/services/camera.service.ts
import { Injectable } from '@angular/core';
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';

@Injectable({ providedIn: 'root' })
export class CameraService {
  async takePicture(): Promise<Photo> {
    return await Camera.getPhoto({
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      quality: 90,
      width: 1920,
      height: 1080,
      correctOrientation: true,
      saveToGallery: false,
    });
  }

  async selectFromGallery(): Promise<Photo> {
    return await Camera.getPhoto({
      resultType: CameraResultType.Uri,
      source: CameraSource.Photos,
      quality: 90,
      width: 1920,
      height: 1080,
    });
  }

  async savePhoto(photo: Photo, filename: string): Promise<string> {
    const base64Data = await this.readAsBase64(photo);

    const savedFile = await Filesystem.writeFile({
      path: `hubblewave/${filename}`,
      data: base64Data,
      directory: Directory.Data,
    });

    return savedFile.uri;
  }

  private async readAsBase64(photo: Photo): Promise<string> {
    if (photo.webPath) {
      const response = await fetch(photo.webPath);
      const blob = await response.blob();
      return await this.convertBlobToBase64(blob);
    }
    return photo.base64String || '';
  }

  private convertBlobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        resolve(reader.result as string);
      };
      reader.readAsDataURL(blob);
    });
  }
}
```

### GPS/Location Services

```typescript
// src/app/services/location.service.ts
import { Injectable } from '@angular/core';
import { Geolocation, Position } from '@capacitor/geolocation';

@Injectable({ providedIn: 'root' })
export class LocationService {
  async getCurrentPosition(): Promise<Position> {
    const coordinates = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });

    return coordinates;
  }

  async watchPosition(callback: (position: Position) => void): Promise<string> {
    const watchId = await Geolocation.watchPosition(
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
      (position, error) => {
        if (error) {
          console.error('Location error:', error);
          return;
        }
        if (position) {
          callback(position);
        }
      }
    );

    return watchId;
  }

  async clearWatch(watchId: string): Promise<void> {
    await Geolocation.clearWatch({ id: watchId });
  }

  async checkPermissions(): Promise<boolean> {
    const status = await Geolocation.checkPermissions();
    return status.location === 'granted';
  }

  async requestPermissions(): Promise<boolean> {
    const status = await Geolocation.requestPermissions();
    return status.location === 'granted';
  }
}
```

### Push Notifications

```typescript
// src/app/services/push-notification.service.ts
import { Injectable } from '@angular/core';
import {
  PushNotifications,
  PushNotificationSchema,
  ActionPerformed,
  Token,
} from '@capacitor/push-notifications';

@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  async initialize(): Promise<void> {
    // Request permission
    const permStatus = await PushNotifications.requestPermissions();

    if (permStatus.receive === 'granted') {
      // Register with Apple / Google
      await PushNotifications.register();
    }

    // Listen for registration
    PushNotifications.addListener('registration', (token: Token) => {
      console.log('Push registration success, token: ' + token.value);
      this.sendTokenToServer(token.value);
    });

    // Listen for errors
    PushNotifications.addListener('registrationError', (error: any) => {
      console.error('Push registration error: ', error);
    });

    // Show notification
    PushNotifications.addListener(
      'pushNotificationReceived',
      (notification: PushNotificationSchema) => {
        console.log('Push received: ' + JSON.stringify(notification));
        this.handleNotification(notification);
      }
    );

    // Handle notification tap
    PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (notification: ActionPerformed) => {
        console.log('Push action performed: ' + JSON.stringify(notification));
        this.handleNotificationAction(notification);
      }
    );
  }

  private async sendTokenToServer(token: string): Promise<void> {
    // Send token to backend for storing
    // await this.api.post('/api/devices/token', { token });
  }

  private handleNotification(notification: PushNotificationSchema): void {
    // Handle received notification
    // Could show in-app banner, update badge, etc.
  }

  private handleNotificationAction(action: ActionPerformed): void {
    // Navigate to relevant screen based on notification data
    const data = action.notification.data;
    if (data.taskId) {
      // Navigate to task
    } else if (data.projectId) {
      // Navigate to project
    }
  }
}
```

---

## Offline-First Architecture

### Service Worker Strategy

```typescript
// src/service-worker.js (Angular PWA)
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// API calls - Network first with cache fallback
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24, // 24 hours
      }),
    ],
  })
);

// Static assets - Cache first
registerRoute(
  ({ request }) => request.destination === 'style' || request.destination === 'script',
  new CacheFirst({
    cacheName: 'static-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
      }),
    ],
  })
);

// Images - Cache first
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'image-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
      }),
    ],
  })
);

// HTML - Stale while revalidate
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new StaleWhileRevalidate({
    cacheName: 'html-cache',
  })
);
```

### IndexedDB Storage

```typescript
// src/app/services/offline-storage.service.ts
import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';

@Injectable({ providedIn: 'root' })
export class OfflineStorageService {
  private _storage: Storage | null = null;

  constructor(private storage: Storage) {}

  async init() {
    this._storage = await this.storage.create();
  }

  // Projects
  async saveProjects(projects: any[]): Promise<void> {
    await this._storage?.set('projects', projects);
    await this._storage?.set('projects_timestamp', Date.now());
  }

  async getProjects(): Promise<any[]> {
    return (await this._storage?.get('projects')) || [];
  }

  // Tasks
  async saveTasks(projectId: string, tasks: any[]): Promise<void> {
    await this._storage?.set(`tasks_${projectId}`, tasks);
    await this._storage?.set(`tasks_${projectId}_timestamp`, Date.now());
  }

  async getTasks(projectId: string): Promise<any[]> {
    return (await this._storage?.get(`tasks_${projectId}`)) || [];
  }

  // Pending changes (for sync)
  async addPendingChange(change: any): Promise<void> {
    const pending = await this.getPendingChanges();
    pending.push({ ...change, timestamp: Date.now(), id: this.generateId() });
    await this._storage?.set('pending_changes', pending);
  }

  async getPendingChanges(): Promise<any[]> {
    return (await this._storage?.get('pending_changes')) || [];
  }

  async removePendingChange(id: string): Promise<void> {
    const pending = await this.getPendingChanges();
    const filtered = pending.filter((c) => c.id !== id);
    await this._storage?.set('pending_changes', filtered);
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### Sync Service

```typescript
// src/app/services/sync.service.ts
import { Injectable } from '@angular/core';
import { Network } from '@capacitor/network';
import { OfflineStorageService } from './offline-storage.service';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class SyncService {
  private isSyncing = false;

  constructor(
    private offlineStorage: OfflineStorageService,
    private api: ApiService
  ) {
    this.initializeNetworkListener();
  }

  private async initializeNetworkListener(): Promise<void> {
    // Listen for network status changes
    Network.addListener('networkStatusChange', (status) => {
      if (status.connected && !this.isSyncing) {
        this.sync();
      }
    });

    // Check current status
    const status = await Network.getStatus();
    if (status.connected) {
      this.sync();
    }
  }

  async sync(): Promise<void> {
    if (this.isSyncing) return;

    this.isSyncing = true;

    try {
      // Get pending changes
      const pending = await this.offlineStorage.getPendingChanges();

      // Upload pending changes
      for (const change of pending) {
        try {
          await this.uploadChange(change);
          await this.offlineStorage.removePendingChange(change.id);
        } catch (error) {
          console.error('Failed to sync change:', change, error);
          // Keep in pending queue for next sync
        }
      }

      // Download latest data
      await this.downloadLatestData();

    } finally {
      this.isSyncing = false;
    }
  }

  private async uploadChange(change: any): Promise<void> {
    switch (change.type) {
      case 'create_task':
        await this.api.createTask(change.data);
        break;
      case 'update_task':
        await this.api.updateTask(change.id, change.data);
        break;
      case 'delete_task':
        await this.api.deleteTask(change.id);
        break;
      // ... other change types
    }
  }

  private async downloadLatestData(): Promise<void> {
    // Download projects
    const projects = await this.api.getProjects();
    await this.offlineStorage.saveProjects(projects);

    // Download tasks for each project
    for (const project of projects) {
      const tasks = await this.api.getTasks(project.id);
      await this.offlineStorage.saveTasks(project.id, tasks);
    }
  }
}
```

---

## Performance Optimization

### Lazy Loading

```typescript
// src/app/app-routing.module.ts
const routes: Routes = [
  {
    path: 'dashboard',
    loadChildren: () =>
      import('./dashboard/dashboard.module').then((m) => m.DashboardModule),
  },
  {
    path: 'projects',
    loadChildren: () =>
      import('./projects/projects.module').then((m) => m.ProjectsModule),
  },
  {
    path: 'tasks',
    loadChildren: () =>
      import('./tasks/tasks.module').then((m) => m.TasksModule),
  },
];
```

### Virtual Scrolling

```typescript
// src/app/components/task-list/task-list.component.ts
import { Component, Input } from '@angular/core';
import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';

@Component({
  selector: 'hw-task-list',
  template: `
    <cdk-virtual-scroll-viewport
      itemSize="64"
      class="task-list-viewport"
      [style.height.px]="viewportHeight">
      <hw-task-item
        *cdkVirtualFor="let task of tasks"
        [task]="task"
        (click)="onTaskClick(task)">
      </hw-task-item>
    </cdk-virtual-scroll-viewport>
  `,
  styles: [`
    .task-list-viewport {
      width: 100%;
      overflow-y: auto;
    }
  `]
})
export class TaskListComponent {
  @Input() tasks: any[] = [];
  @Input() viewportHeight = 600;

  onTaskClick(task: any): void {
    // Handle task click
  }
}
```

### Image Optimization

```typescript
// src/app/directives/lazy-img.directive.ts
import { Directive, ElementRef, Input, OnInit } from '@angular/core';

@Directive({
  selector: 'img[hwLazyLoad]',
})
export class LazyImgDirective implements OnInit {
  @Input() src!: string;
  @Input() placeholder = 'data:image/svg+xml,...'; // SVG placeholder

  constructor(private el: ElementRef<HTMLImageElement>) {}

  ngOnInit(): void {
    // Set placeholder
    this.el.nativeElement.src = this.placeholder;

    // Use Intersection Observer
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          this.loadImage();
          observer.unobserve(this.el.nativeElement);
        }
      });
    });

    observer.observe(this.el.nativeElement);
  }

  private loadImage(): void {
    const img = new Image();
    img.src = this.src;
    img.onload = () => {
      this.el.nativeElement.src = this.src;
    };
  }
}
```

---

## App Store Deployment

### iOS Deployment

#### 1. Configure Xcode Project

```bash
# Open Xcode
npx cap open ios

# In Xcode:
# 1. Select project in navigator
# 2. Select target "App"
# 3. General tab:
#    - Display Name: HubbleWave
#    - Bundle Identifier: com.hubblewave.app
#    - Version: 1.0.0
#    - Build: 1
# 4. Signing & Capabilities:
#    - Team: Select your team
#    - Signing Certificate: Apple Distribution
#    - Provisioning Profile: App Store
```

#### 2. Build Archive

```bash
# In Xcode:
# 1. Select "Any iOS Device" as target
# 2. Product > Archive
# 3. Wait for archive to complete (5-10 min)
# 4. Organizer window opens automatically
```

#### 3. Upload to App Store Connect

```bash
# In Organizer:
# 1. Select latest archive
# 2. Click "Distribute App"
# 3. Select "App Store Connect"
# 4. Click "Upload"
# 5. Select signing options (automatic recommended)
# 6. Click "Upload"
# 7. Wait for upload (5-15 min)
```

#### 4. Submit for Review

```bash
# In App Store Connect:
# 1. Go to "My Apps"
# 2. Select HubbleWave
# 3. Click "+ Version" (1.0.0)
# 4. Fill in release notes
# 5. Select build
# 6. Add screenshots
# 7. Fill in app description
# 8. Add keywords
# 9. Set pricing ($0 free)
# 10. Click "Submit for Review"
```

### Android Deployment

#### 1. Generate Signed APK

```bash
# In Android Studio:
# 1. Build > Generate Signed Bundle/APK
# 2. Select "Android App Bundle"
# 3. Click "Next"
# 4. Create or select keystore
# 5. Fill in keystore details:
#    - Key store path: ./android/release.keystore
#    - Password: [secure password]
#    - Key alias: hubblewave
#    - Key password: [secure password]
# 6. Click "Next"
# 7. Select "release" build variant
# 8. Click "Finish"
```

#### 2. Upload to Play Console

```bash
# In Play Console:
# 1. Select app
# 2. Production > Create new release
# 3. Upload AAB file
# 4. Add release notes
# 5. Review and roll out
```

#### 3. Submit for Review

```bash
# In Play Console:
# 1. Complete store listing
# 2. Add screenshots (all required sizes)
# 3. Set content rating
# 4. Set pricing (Free)
# 5. Submit for review
```

---

**Document Version:** 1.0
**Last Updated:** 2025-12-30
**Mobile Status:** Production Ready
