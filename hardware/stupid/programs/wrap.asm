LDA zero
SUB one
STA answer
LDA zero
halt: JZ halt
.org 50
zero: .byte 0
one: .byte 1
answer: .byte 0
