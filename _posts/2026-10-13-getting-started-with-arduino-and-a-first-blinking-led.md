---
layout: post
title: Getting Started with Arduino and a First Blinking LED
date: 2026-10-13
description: The classic first electronics project, explained step by step, and what it teaches about pins, power, and code.
tags: [Electronics, Arduino, Beginners]
---

The blinking LED is the "hello world" of electronics. It's small, but it teaches the basics of how code controls hardware.

You'll need an Arduino board, an LED, a 220 Ω resistor, and two jumper wires.

1. Connect the LED's longer leg (the anode) through the resistor to digital pin 13.
2. Connect the shorter leg to a GND pin.
3. Upload this sketch:

```cpp
void setup() {
  pinMode(13, OUTPUT);
}

void loop() {
  digitalWrite(13, HIGH);
  delay(500);
  digitalWrite(13, LOW);
  delay(500);
}
```

The resistor matters. Without it, too much current flows and the LED can burn out. Once it blinks, try changing the delay values, or add a second LED on another pin.
