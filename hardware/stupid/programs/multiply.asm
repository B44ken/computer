LDA zero
SUB y
STA negative_y
LDA x
STA counter
loop: LDA counter
JZ done
SUB one
STA counter
LDA answer
SUB negative_y
STA answer
LDA zero
JZ loop
done: LDA zero
halt: JZ halt
.org 50
x: .byte 6
y: .byte 7
answer: .byte 0
counter: .byte 0
negative_y: .byte 0
one: .byte 1
zero: .byte 0
