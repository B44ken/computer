LDA patch
STA patched
LDA zero
JZ patched
patched: LDA bad
STA answer
landing: LDA zero
halt: JZ halt
.org 50
patch: .byte 198
bad: .byte 99
answer: .byte 0
zero: .byte 0
