LDA zero
SUB y
STA negative_y
LDA x
SUB negative_y
STA answer
LDA zero
halt: JZ halt
.org 50
x: .byte 7
y: .byte 5
answer: .byte 0
negative_y: .byte 0
zero: .byte 0
