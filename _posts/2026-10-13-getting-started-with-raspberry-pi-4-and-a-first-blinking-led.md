---
layout: post
title: Getting Started with Raspberry Pi 4 and a First Blinking LED
date: 2026-10-13
description: The classic first electronics project on a Raspberry Pi 4, explained step by step, and what it teaches about GPIO pins, power, and Python code.
tags: [Electronics, Raspberry Pi, Beginners]
---

The blinking LED is the "hello world" of electronics. It's small, but it teaches the basics of how code controls hardware.

You'll need a Raspberry Pi 4 running Raspberry Pi OS, an LED, a 220 Ω resistor, and two jumper wires. Shut the Pi down and unplug it before you wire anything.

1. Connect the LED's longer leg (the anode) through the resistor to GPIO 17 (physical pin 11).
2. Connect the shorter leg to a GND pin, such as physical pin 9.
3. Boot the Pi and save this script as `blink.py`:

```python
from gpiozero import LED
from time import sleep

led = LED(17)

while True:
    led.on()
    sleep(0.5)
    led.off()
    sleep(0.5)
```

4. Run it with `python3 blink.py` and press Ctrl+C to stop.

The resistor matters. GPIO pins on the Pi 4 output 3.3 V and are not designed for much current, so without it the LED can burn out and the pin can be damaged. Once it blinks, try changing the sleep values, or add a second LED on another GPIO pin.
