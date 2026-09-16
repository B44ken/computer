LDA x
SUB y
STA answer
LDA zero
halt: JZ halt
.org 50
x: .byte 9
y: .byte 4
answer: .byte 0
zero: .byte 0
