loop: LDA counter
SUB one
STA counter
JZ done
LDA zero
JZ loop
done: LDA zero
halt: JZ halt
.org 50
counter: .byte 10
one: .byte 1
zero: .byte 0
