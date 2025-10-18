Hello,

I am a passionate developer with more than 20 years of XP in several languages, technologies and compagnies.

I am currently working as a Lead Software Engineer, at [IBM](https://www.ibm.com/) in the [Terracotta](https://www.terracotta.org) R&D team since 2015.
We built Ehcache and Terracotta Store and provide clustering and management solutions for caching and storing huge amount of data efficiently with no downtime, low latency in a consistency or availability mode.

I am also an Arduino / ESP32 developer, creator and maintainer of several [Open Source Projects](https://mathieu.carbou.me/) that you will find below.

I've been involved during 10 years in the [Montreal Java User Group](https://www.montreal-jug.org/) that I've bootstrapped in 2010 with a friend (David). This is now one of the biggest JUG over the world.
I was also part of the [Devoxx4Kids Quebec](http://www.devoxx4kids.org/quebec/) organization.

I'm also an enthusiast photographer: feel free to visit my [Photography](https://www.mathieu.photography/) website!
You will find some articles about neutral density filters and infrared photography too.

- [Articles](#articles)
- [Projects](#projects)
  - [Solar Routers / Diverter](#solar-routers--diverter)
  - [Beelance](#beelance)
  - [License Maven Plugin](#license-maven-plugin)
- [Arduino / ESP32 Libraries](#arduino--esp32-libraries)
- [Java Libraries](#java-libraries)
- [Contributing / collaborating to these projects](#contributing--collaborating-to-these-projects)
- [Statistics](#statistics)

[![](https://img.shields.io/badge/github-mathieucarbou-211F1F?logo=github&logoColor=white&style=flat-square)](https://github.com/mathieucarbou)
[![](https://img.shields.io/badge/linkedin-mathieucarbou-0072B1?logo=linkedin&style=flat-square)](https://www.linkedin.com/in/mathieucarbou/)
[![](https://img.shields.io/badge/photography-mathieu.photography-1BC?logo=react&logoColor=white&style=flat-square)](https://www.mathieu.photography/)
[![](https://img.shields.io/badge/flickr-mathieucarbou-ff69b4?logo=flickr&style=flat-square)](https://www.flickr.com/photos/mathieucarbou/)

## Articles

**Solar diverters / routers**

- [Shelly Solar Diverter / Router](https://yasolr.carbou.me/blog/2024-07-01_shelly_solar_diverter)
- [Home Assistant Solar Diverter / Router](https://yasolr.carbou.me/blog/2024-09-05_ha_diverter)
- [Zero-Cross Pulse Detection](https://yasolr.carbou.me/blog/2024-07-31_zero-cross_pulse_detection)
- [The Importance of a good ZCD circuit for a solar router](https://yasolr.carbou.me/blog/2024-07-24_the_importance_of_a_good_zcd_circuit)

**JSY**

- [Everything on le JSY](https://yasolr.carbou.me/blog/2024-06-26_everything_on_the_jsy)
- [The new JSY-MK-194G](https://yasolr.carbou.me/blog/2024-11-07_jsy_mk_194g)
- [Remote JSY through UDP](https://yasolr.carbou.me/blog/2024-06-25_remote_jsy)

**Home Assistant**

- [Automatically limit inverter outputs based on grid excess with Home Assistant and OpenDTU](https://gist.github.com/mathieucarbou/382556f1279d612962e03232544692d1)
- [Home Assistant Solar Diverter / Router](https://yasolr.carbou.me/blog/2024-09-05_ha_diverter)
- [ESPHome with Dallas Temperature Sensor](https://gist.github.com/mathieucarbou/4706cfaa2562207fee1ea48012f4dc5f)
- [Home Assistant H&T (Hygrostat & Thermostat)](https://gist.github.com/mathieucarbou/ebea1c204bbf88a3b35072f78b60875f)
- [Home Assistant: % autoconsommation temps réel](https://gist.github.com/mathieucarbou/b841b9c1b7383bbda27569ebe17dad0e)
- [Home Assistant + Shelly + EDF HP/HC](https://gist.github.com/mathieucarbou/51a4a99be64b11e042a597b8e43ddfb7)
- [Home Assistant + RTE Tempo + Shelly](https://gist.github.com/mathieucarbou/e1667cd8e4acd93199b8c879b81aa787)
- [Home Assistant OpenEVSE Integration backed by MQTT](https://gist.github.com/mathieucarbou/92a3d5e0dc38d6b68aa1bdaf153a80c5)
- [Suivi énergétique](https://gist.github.com/mathieucarbou/290e26605437724d3b70332005e3def6)
- [Linky Teleinformation (TIC) + ESPHome + Home Assistant](https://gist.github.com/mathieucarbou/886d2a6f5c0b51bb261d6a1329beb08d)
- [OpenDTU + Home Assistant](https://gist.github.com/mathieucarbou/70539ced8f330be6205a91897ea1c639)
- [Renault Zoé E-Tech R110 + Home Assistant + Charge auto avec le soleil](https://gist.github.com/mathieucarbou/e54c29c1f6b091c0e69ad1164550502e)

## Projects

### Solar Routers / Diverter

I am specialized in solar routing / diversion. I have created many solar routers and also libraries to help build solar routers.

|                                                                                           |        |                                                                                                           |
| :---------------------------------------------------------------------------------------- | :----: | :-------------------------------------------------------------------------------------------------------- |
| [Shelly Pro Solar Router](https://yasolr.carbou.me/blog/2024-07-01_shelly_solar_diverter) | Shelly | Your Solar Router based on Shelly components and LSA dimmer                                               |
| [Home Assistant Solar Router](https://yasolr.carbou.me/blog/2024-09-05_ha_diverter)       |   HA   | Solar Router controlled by Home Assistant and using a Shelly Dimmer Gen3 + LSA for the dimmer             |
| [YaS☀️lR (Yet another Solar Router)](https://yasolr.carbou.me)                            | ESP32  | Heat water with your Solar Production Excess with the more powerful and precise solar diverter out there! |

### Beelance

|                                        |       |                                                                |
| :------------------------------------- | :---: | :------------------------------------------------------------- |
| [Beelance](https://beelance.carbou.me) | ESP32 | Autonomous and remotely connected weight scale for beehives 🐝 |

### License Maven Plugin

|                                                                        |       |                                                                                |
| :--------------------------------------------------------------------- | :---: | :----------------------------------------------------------------------------- |
| [License Maven Plugin](https://mathieu.carbou.me/license-maven-plugin) | Maven | Maven plugin which helps managing license headers in your project source files |

## Arduino / ESP32 Libraries

**AsyncTCP and ESPAsyncWebServer**

I am actively maintaining these libraries as part of [ESP32Async](https://github.com/ESP32Async) organization:

|                                                                      |       |                                                                                                                  |
| :------------------------------------------------------------------- | :---: | :--------------------------------------------------------------------------------------------------------------- |
| [AsyncTCP](https://github.com/ESP32Async/AsyncTCP)                   | ESP32 | AsyncTCP is a library for ESP32 Arduino that facilitates the use of TCP connections in an asynchronous way       |
| [ESPAsyncWebServer](https://github.com/ESP32Async/ESPAsyncWebServer) | ESP32 | WebSocket, SSE, Authentication, Arduino Json 7, File Upload, Static File serving, URL Rewrite, URL Redirect, etc |

**Electricity:**

|                                                                      |       |                                                                                                                                                                                                                             |
| :------------------------------------------------------------------- | :---: | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [MycilaJSY](https://mathieu.carbou.me/MycilaJSY)                     | ESP32 | Arduino / ESP32 library for the JSY1031, JSY-MK-163, JSY-MK-193, JSY-MK-194, JSY-MK-227, JSY-MK-229, JSY-MK-333 families single-phase and three-phase AC bidirectional meters from Shenzhen Jiansiyan Technologies Co, Ltd. |
| [MycilaJSYApp](https://mathieu.carbou.me/MycilaJSYApp)                     | ESP32 | Arduino / ESP32 Web Application for JSY devices |

| [MycilaPulseAnalyzer](https://mathieu.carbou.me/MycilaPulseAnalyzer) | ESP32 | ESP32 / Arduino Library to analyze pulses from a Zero-Cross Detection circuit                                                                                                                                               |
| [MycilaDimmer](https://mathieu.carbou.me/MycilaDimmer)               | ESP32 | ESP32 / Arduino Library to control TRIAC, Random SSR, Voltage Regulator with DfRobot DAC or PWM                                                                                                                             |
| [MycilaPZEM](https://mathieu.carbou.me/MycilaPZEM)       | ESP32 | Arduino / ESP32 library for the PZEM-004T v3 and v4 Power and Energy monitor                                                                                                                                                       |
| [MycilaRelay](https://mathieu.carbou.me/MycilaRelay)                 | ESP32 | Arduino / ESP32 library to control Electromagnetic and Solid State Relays                                                                                                                                                   |

**GPIO Components:**

|                                                                    |       |                                                                                   |
| :----------------------------------------------------------------- | :---: | :-------------------------------------------------------------------------------- |
| [MycilaDS18](https://mathieu.carbou.me/MycilaDS18)                 | ESP32 | ESP32 / Arduino Library for Dallas / Maxim Temperature Integrated Circuits        |
| [MycilaEasyDisplay](https://mathieu.carbou.me/MycilaEasyDisplay)   | ESP32 | Easy to use Arduino / ESP32 library for SH1106, SH1107, SSD1306 OLED I2C displays |
| [MycilaTrafficLight](https://mathieu.carbou.me/MycilaTrafficLight) | ESP32 | ESP32 / Arduino Library for Traffic Light LEDs                                    |

**MQTT / Home Assistant:**

|                                                                  |       |                                                                                     |
| :--------------------------------------------------------------- | :---: | :---------------------------------------------------------------------------------- |
| [MycilaHADiscovery](https://mathieu.carbou.me/MycilaHADiscovery) | ESP32 | Simple and efficient Home Assistant Discovery library for Arduino / ESP32           |
| [MycilaMQTT](https://mathieu.carbou.me/MycilaMQTT)               | ESP32 | A simple and efficient MQTT/MQTTS client for Arduino / ESP32 based on Espressif API |

**Network:**

|                                                                |       |                                                                                         |
| :------------------------------------------------------------- | :---: | :-------------------------------------------------------------------------------------- |
| [MycilaESPConnect](https://mathieu.carbou.me/MycilaESPConnect) | ESP32 | Simple & Easy Network Manager with Captive Portal for ESP32 supporting Ethernet         |
| [MycilaNTP](https://mathieu.carbou.me/MycilaNTP)               | ESP32 | A simple and efficient NTP library for ESP32 / Arduino                                  |
| [MycilaWebSerial](https://mathieu.carbou.me/MycilaWebSerial)   | ESP32 | WebSerial is a Serial Monitor for ESP32 that can be accessed remotely via a web browser |

**System:**

|                                                                  |       |                                                                                                                |
| :--------------------------------------------------------------- | :---: | :------------------------------------------------------------------------------------------------------------- |
| [MycilaConfig](https://mathieu.carbou.me/MycilaConfig)           | ESP32 | A simple and efficient config library                                                                          |
| [MycilaLogger](https://mathieu.carbou.me/MycilaLogger)           | ESP32 | A simple and efficient logging library for Arduino / ESP32                                                     |
| [MycilaSafeBoot](https://mathieu.carbou.me/MycilaSafeBoot)       | ESP32 | MycilaSafeBoot is a Web OTA recovery partition for ESP32 / Arduino allowing for a bigger application partition |
| [MycilaSystem](https://mathieu.carbou.me/MycilaSystem)           | ESP32 | Arduino / ESP32 library for system-related tasks                                                               |
| [MycilaTaskManager](https://mathieu.carbou.me/MycilaTaskManager) | ESP32 | Arduino / ESP32 Task Manager Library                                                                           |
| [MycilaTaskMonitor](https://mathieu.carbou.me/MycilaTaskMonitor) | ESP32 | Arduino / ESP32 library to monitor task priority and stack high watermark                                      |
| [MycilaTrial](https://mathieu.carbou.me/MycilaTrial)             | ESP32 | Arduino / ESP32 library to add a trial duration in your app                                                    |
| [MycilaUtilities](https://mathieu.carbou.me/MycilaUtilities)     | ESP32 | Utils stuff for Arduino / ESP32 like Time, String functions, CircularBuffer, etc                               |

## Java Libraries

|                                                      |      |                                                 |
| :--------------------------------------------------- | :--: | :---------------------------------------------- |
| [Mycila Guice](https://mathieu.carbou.me/guice)      | Java | Google Guice Extensions                         |
| [Mycila Pub Sub](https://mathieu.carbou.me/pubsub)   | Java | In-JVM Event API                                |
| [Mycila XML Tool](https://mathieu.carbou.me/xmltool) | Java | Manage XML document through a simple fluent API |

## Contributing / collaborating to these projects

|                                                                                                                                                            |       |                                                                                                                                                                                                           |
| :--------------------------------------------------------------------------------------------------------------------------------------------------------- | :---: | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Arduino Core](https://github.com/espressif/arduino-esp32) from [Espressif Systems](https://github.com/espressif)                                          | ESP32 | I have contributed fixes and WebServer improvements such as middleware support                                                                                                                            |
| [ESP-DASH](https://github.com/ayushsharma82/ESP-DASH) and [ESP-DASH Pro](https://espdash.pro) from [@ayushsharma82](https://github.com/ayushsharma82)      | ESP32 | ESP-DASH is a library for ESP32 Arduino that facilitates the use of a dashboard in an asynchronous way. I have contributed most of the recently newly added fixes and features of the OSS and Pro version |
| [pioarduino](https://github.com/pioarduino/platform-espressif32) ([Discord](https://discord.gg/GRBX2hXBE3))                                                | ESP32 | PlatformIO replacement with Vscode extension which is compatible with Arduino 3 and new boards                                                                                                            |
| [WebSerial](https://github.com/ayushsharma82/WebSerial) and [WebSerial Pro](https://webserial.pro) from [@ayushsharma82](https://github.com/ayushsharma82) | ESP32 | WebSerial is a Serial Monitor for ESP32 that can be accessed remotely via a web browser. I have contributing the recent fixes and high performance mode                                                   |

## Statistics

[![](https://github-readme-stats.vercel.app/api/top-langs/?username=mathieucarbou&layout=compact&show_icons=true&theme=dark#gh-dark-mode-only&count_private=true&include_all_commits=true)](https://github.com/mathieucarbou/)
[![](https://github-readme-stats.vercel.app/api?username=mathieucarbou&show_icons=true&theme=dark#gh-dark-mode-only&count_private=true&include_all_commits=true)](https://github.com/mathieucarbou/)
