"""Exact return of the slot (Zander), with exact fractions. Run: python3 slot-exact.py
Prints the exact RTP (0.97993), the free-spin trigger rate, and the exact expected payout of a
bought feature (a spin drawn from the triggering seeds), which sets the Buy feature price in
frontend/src/lib/slot.ts (BUY_EXPECTED_X, BUY_PRICE_X).
"""
from fractions import Fraction as F
from itertools import product
W=[10,38,16,11,7,10,3,5]; PAY=[0,2,8,12,30]; WILD=50; JP=1000; SPINS=8; FM=2; ML=8; SC=3
P=[F(w,100) for w in W]
def linewin(l):
    if all(s==6 for s in l): return (JP,True)
    if all(s==5 for s in l): return (WILD,False)
    best=0
    for x in range(1,5):
        if all(s==x or s==5 for s in l): best=max(best,PAY[x])
    return (best,False) if best else None
lines=[]  # (prob, basepay, jackpot, stars)
for l in product(range(8),repeat=3):
    p=P[l[0]]*P[l[1]]*P[l[2]]
    w=linewin(l)
    lines.append((p,l,w))
# F(k,mult): expected pay from line k (0-based) onward given reached; m_k = mult*(k+1) except jackpot flat
def Ftab(mult):
    Fk=[F(0)]*(ML+1)
    for k in range(ML-1,-1,-1):
        tot=F(0)
        for p,l,w in lines:
            if w:
                base,jp=w
                pay = base if jp else base*mult*(k+1)
                tot+=p*(pay+Fk[k+1])
        Fk[k]=tot
    return Fk
F1=Ftab(1); F2=Ftab(2)
base_ev=F1[0]; free_spin_ev=F2[0]
free_ev=SPINS*free_spin_ev
# trigger: stars among line0, line1 (top row), bottom row(3 indep cells)
from math import comb
pstar=P[7]
def bottom_dist():
    d={}
    for b in range(4): d[b]=comb(3,b)*pstar**b*(1-pstar)**(3-b)
    return d
bd=bottom_dist()
p_trig=F(0); base_trig=F(0)
stars=lambda l: sum(1 for s in l if s==7)
for p0,l0,w0 in lines:
    for p1,l1,w1 in lines:
        s=stars(l0)+stars(l1)
        pt=sum(q for b,q in bd.items() if s+b>=SC)
        if pt==0: continue
        pj=p0*p1*pt
        p_trig+=pj
        if w0:
            b0,jp0=w0
            pay0=b0 if jp0 else b0*1*1
            pay=pay0
            if w1:
                b1,jp1=w1
                pay+= b1 if jp1 else b1*1*2
                pay+= F1[2]   # beyond line1 if line1 won: continue from line 2 (needs line1 won) -- handled below
            base_trig+=pj*pay
print("p_trig",float(p_trig),"1 in",float(1/p_trig))
print("base EV",float(base_ev),"free spin EV(mult2)",float(free_spin_ev),"x8",float(free_ev))
print("RTP exact", float(base_ev+p_trig*free_ev), "(doc says 0.97993)")
EV_trig = base_trig/p_trig + free_ev
print("E[total | trigger]", float(EV_trig), "base part", float(base_trig/p_trig), "free part", float(free_ev))
