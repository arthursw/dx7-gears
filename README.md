DX7 Gears
=================

A musical Game of Life based on [DX7 Synth](https://github.com/mmontag/dx7-synth-js/).

The algorithm works as followed:
 - only the first column evolves according to the Game of Life rules, 
 - the cells move to the left at each step,
 - once at the end of the track, the cell go back to the first column, creating a evolving cycles.

![](http://voices.washingtonpost.com/postrock/yamaha-dx-7.jpg)

DX7 FM synthesis using the Web Audio and Web MIDI API. Works in Chrome and Firefox.
Use a MIDI or QWERTY keyboard to play the synth.

[Live demo](http://mmontag.github.io/dx7-synth-js/)

Many thanks to:

- John Chowning and Yamaha
- Sean Bolton, author of Hexter, a DSSI DX7 modeler
- Phil Cowans, author of Javascript-DX7 music hackday prototype https://github.com/philcowans/Javascript-DX7
- Jamie Bullock, Ewan Macpherson, and other independent engineers who provided specs about the DX7/TX7 implementation
- Propellerhead Software, for the PX7 Reason Rack Extension
- Native Instruments, for the FM7 and FM8 VSTi software instruments
