# ESP32 / Arduino

I build asynchronous networking, energy-metering and system libraries for ESP32 / Arduino, and I help maintain two widely used asynchronous networking libraries in the **[ESP32Async](https://github.com/ESP32Async)** organization.

## 🧵 ESP32Async

- **[ESPAsyncWebServer](https://github.com/ESP32Async/ESPAsyncWebServer)** — asynchronous HTTP and WebSocket server, with support for SSE, middleware, authentication, file serving and more.
- **[AsyncTCP](https://github.com/ESP32Async/AsyncTCP)** — asynchronous TCP networking for ESP32 Arduino; the networking foundation used by ESPAsyncWebServer.

The repositories under `ESP32Async` are the active upstream projects. My older personal repositories for these libraries are archived.

## 🤝 Other open-source collaborations

### [ESP-DASH](https://github.com/ayushsharma82/ESP-DASH) · [SOFTT](https://softt.io/)

I have contributed extensively to **ESP-DASH** and **ESP-DASH Pro**, the embedded dashboard projects created by [Ayush Sharma](https://github.com/ayushsharma82), founder of [SOFTT](https://softt.io/).

A notable contribution is the **memory-optimized C++ backend introduced in ESP-DASH v5**, which I reworked. Earlier contributions included memory and WebSocket improvements, transfer-performance work, and compatibility fixes for Arduino 3 / ESP-IDF 5.

- [ESP-DASH v5 release notes](https://github.com/ayushsharma82/ESP-DASH/releases/tag/v5.0.0)
- [ESP-DASH release history](https://github.com/ayushsharma82/ESP-DASH/releases)
- [ESP-DASH Pro](https://espdash.pro/)

### Other projects

- **[WebSerial](https://github.com/ayushsharma82/WebSerial) / [WebSerial Pro](https://webserial.pro/)** — fixes and performance improvements for browser-based serial monitoring.
- **[Arduino-ESP32 core](https://github.com/espressif/arduino-esp32)** — fixes and WebServer improvements, including middleware support.
- **[pioarduino](https://github.com/pioarduino/platform-espressif32)** — contributions and collaboration around the PlatformIO Espressif32 platform.

### 🏅 Arduino Open Source Report 2025

The [Arduino Open Source Report 2025](ArduinoOpenSourceReport2025.pdf) lists **Mathieu Carbou with 154 library releases** in 2025 and **ESP32 Asynchronous Networking with 40 releases**. The report's ranking is based on release frequency.

[Read the report](ArduinoOpenSourceReport2025.pdf){ .md-button } [Arduino Forum discussion](https://forum.arduino.cc/t/arduino-open-source-report-2025/1437540){ .md-button }

## 🧩 Mycila Arduino / ESP32 libraries

A collection of small, focused libraries for building connected ESP32 applications. Most are published under the **Mycila** name.

### ⚡ Power, metering & control

- [MycilaJSY](https://github.com/mathieucarbou/MycilaJSY) — drivers for JSY single-phase and three-phase bidirectional energy meters.
- [MycilaJSYApp](https://github.com/mathieucarbou/MycilaJSYApp) — web application for JSY energy meters.
- [MycilaPZEM](https://github.com/mathieucarbou/MycilaPZEM) — PZEM-004T power and energy meter.
- [MycilaPulseAnalyzer](https://github.com/mathieucarbou/MycilaPulseAnalyzer) — zero-cross pulse analysis.
- [MycilaDimmer](https://github.com/mathieucarbou/MycilaDimmer) — TRIAC, SSR and voltage-regulator dimming.
- [MycilaRelay](https://github.com/mathieucarbou/MycilaRelay) — electromagnetic and solid-state relay control.

### 🌐 Connectivity & Home Assistant

- [MycilaESPConnect](https://github.com/mathieucarbou/MycilaESPConnect) — Wi-Fi / Ethernet network manager with captive portal.
- [MycilaMQTT](https://github.com/mathieucarbou/MycilaMQTT) — MQTT / MQTTS helper based on Espressif's MQTT client.
- [MycilaHADiscovery](https://github.com/mathieucarbou/MycilaHADiscovery) — Home Assistant MQTT Discovery.
- [MycilaNTP](https://github.com/mathieucarbou/MycilaNTP) — NTP time synchronization.
- [MycilaWebSerial](https://github.com/mathieucarbou/MycilaWebSerial) — lightweight browser-based serial monitor.

### 🧠 Runtime, diagnostics & system

- [MycilaConfig](https://github.com/mathieucarbou/MycilaConfig) — application configuration.
- [MycilaDataLogger](https://github.com/mathieucarbou/MycilaDataLogger) — remote serial logs, crashes and stack traces.
- [MycilaLogger](https://github.com/mathieucarbou/MycilaLogger) — logging utilities.
- [MycilaSafeBoot](https://github.com/mathieucarbou/MycilaSafeBoot) — web-based OTA recovery partition.
- [MycilaSystem](https://github.com/mathieucarbou/MycilaSystem) — system-level helpers.
- [MycilaTaskManager](https://github.com/mathieucarbou/MycilaTaskManager) — task management utilities.
- [MycilaTaskMonitor](https://github.com/mathieucarbou/MycilaTaskMonitor) — FreeRTOS task priorities and stack monitoring.
- [MycilaTrial](https://github.com/mathieucarbou/MycilaTrial) — trial-period support for embedded applications.
- [MycilaUtilities](https://github.com/mathieucarbou/MycilaUtilities) — time, string, circular-buffer and general utilities.

### 🖥️ Hardware & displays

- [MycilaDS18](https://github.com/mathieucarbou/MycilaDS18) — Dallas / Maxim temperature sensors.
- [MycilaEasyDisplay](https://github.com/mathieucarbou/MycilaEasyDisplay) — OLED displays, virtual displays and carousels.
- [MycilaTrafficLight](https://github.com/mathieucarbou/MycilaTrafficLight) — traffic-light LED control.
