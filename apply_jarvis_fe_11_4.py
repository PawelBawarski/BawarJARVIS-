#!/usr/bin/env python3
"""JARVIS FE 11.4: conservative, all-or-nothing installer for current UI.
Usage: from BawarJARVIS-/ root: python scripts/apply-fe-11-4.py
Backup files first; do not overwrite UI styles or unrelated code.
"""
from pathlib import Path
from datetime import datetime
import json, re, shutil, sys

ROOT = Path.cwd().resolve()
# Find the repository root regardless of whether the user runs from scripts/.
for candidate in (Path.cwd(), Path.cwd().parent, Path(__file__).resolve().parent, Path(__file__).resolve().parent.parent):
    if (candidate / 'frontend/src/app/core/services/chat-store.ts').is_file():
        ROOT = candidate.resolve()
        break
else:
    sys.exit('ERROR: Put the installer inside the JARVIS repo (root or scripts/).')

# Embedded, inspectable source payload: independent of copy/merge location.
import base64, io, zipfile, zlib
_PAYLOAD = """c-p0UbyQtX*5$+99}wK#^`XJtT>=DmcMonsg1ZEFcXxMpx8RUq!G@min@RU?^~`kly!+3sTI-&(>ef5^?tN-
2%0NH@0RR9jz|z7(mkgKKu>cYP*h2sS2;OInO`NQp?d+LMtWAuZ9qnwHjLZ$387%CL7>z8Q3e*kk);LjLvOYV2MM(D=ufWxEsC<KtuD}{q=B+!
^7o2H{6kU@xmMSRD7cYJ5B%>K|JZr%@>}H`LjJdzq;8z}FgU2!ZKGjec2q6&8hMcTB<?l3&l~Lr{=HvW4d9u9~>$A#zo|9UeCcFMoyW#D1-
Qq=FyN+q9NUV%7yWP;+S*P71G_mXY3dOAY$5j&sdv~>|$JtNjaDNK!BC_8MML0`+ToWx|Q!s!X#9tzhhyuQV&jswM{+=KCB*;fL_{D+@YsWrlX
&F#{ks*S<f|AK1E>zfNPGZ(|+LJ&J275s0^)Dgd*h9Qmo}r`(q1E^#C5?l&Q(@*{z<~#CX5yFKz<rPgw;E@PlR76G$%YHF3(7$|P<=8Ct|2-
AoA^b}v3>q&nvUH+fOI(G2z~T>PWLV=w!cBKYBwRh)U%`(r4dw9)i&^9B1`y!Nzk^$`vLM)_^U9a4ViaV-G?j#sYg;c>*<d?Mu<EV-
u@^yaUnLbMY4gr<u&VO3B;6bze;MS$%l4HVvad02lIogl3PjiKwIMMSwErLL-
*u|s5>r&7_n*Eck7UjO^?sTjeB*`%TWVv4Emy%Bj8<U08GuVS|^>AAj>Wf<iOoiQ}9#a$EoPmg;{Jula_N5NSUCyls7zzgI`!Q3r}fD@snllG<
n_}Y+m-2;k1D@24>^DBeZRH8fj0H4Q#G@LRx}m<T3VZ4E6C`V{_~V8PJMf#TI-
9dca21Yfu`7zYowGj1gYckhoA@?fVZ>j#ImqwaJnJak$lW%km|p$>q<!jY@|}4;D1p6c!-Usl{S7RL-
|Z5n89jQs+?;5(FKkMtKvZ3PS0~rXIOx@#4$E^j+73@V)H?<i+K?fH1MHlj@0+#VHm^yMjS-S(3v`ur3~0FS*m20pN9vn-QcOMOovHwn9>V%1x
Edfb*(FOoJGM#hYqVNC?-|>DB&PdR-5U21x8MwbPOtizpV0W??c5+~CgqYM<=y*yYsgh0L@dF^=UOxy0i{5WXhu!H)GpHH+SFLv~o4ES=^m*-
CXe;~hTASfmYJdOC%VIg|`Et+VNmeojJF-
{9BZ2skNz3p}c^7u~2PWKxah8ulpXj}{DNVi?7{Pu@UZa@h$Ba@CMb<`rY%Nm;FUkUHfO)7?{mu(71~gA1$*v}6(rD8<C)7L^D%+co)G<g=(x4
dzY;e;2P)7BH^9m^^{sv<7YT*xaw4EAX2+pGFpv4YlDQ^GSG-
5TY0Qeb%r&R|@(Ls`b*GB1d^+;;Pw#8r2pwsT7~g#u&m=5OCf&Z5=Cxy;p2H(A!nykEo?)gcP`Zn&dG_-XMgR_`-
wZY{!ytanPXB<UP~gH^Z$*_f2#j1iHOtz7>c?H9_j@yY~;30Gbpmdq_=sEAbbvA6=4|gvU%+%{<Jso<!T~+G&SJB~;vS7V~K%pu?aoG<dDtHKL
wlm4Yl=lyx#c8XBZ7+{#~EwNqM?5t_7}7IKBlh}heCev>*q5u{UT5}6s}2kD=L@L*gCP+F%#a&NL6yE!=OgGj;T<Unrj9G@vQ_TPvU{{i2Y>2C
*aApigfcmRO(|B7$UCQi<O1GxtEbNM}S;LDWCI#FVVWVFq!wLh`CVc?pnjL3k5T0?14jZYww=^!r~a<!80rN}Rr)%%moYYBAWZ>=`rLA$BfEk_
w%rj+s}s0m40<(Yk%n)U@kWG}qn;Y4GyhC@4~J>PMhTPM&9fuj>*3)P?Z8p@7{#Y(O-7SSURphio+-
RC9zaFyMaD`b~u<6<<_ED!MVmF?>&59@ePXYgm5@`a_UpAIKbF!Yyo>%^(A+rwaMh?(oy0KNEDbtOY~^!y?|ArPHe>L5Qx*%XDDab|{<{2h(9>
;O5HEoc(s7el{D97a2b)6>IGCy0<@8j~W(XqZ$K5J9W}AL~$okIkdY<%#f<p!nq)y`S`1v$nm?QqZikpCBMU-
WCQ+H`%*YA~PZgx(k5`u3Dd`045tV)kQGXCG-tdpa-
7=U0b|+f22;DYRAGIr*WV%dEmL~a4&w~)>A4|`Z|XvabBZTUTKKtdlG9=k?N^1k`IxY*2N077VayihKUkv3Cnd?{wUIkcFLYdXK!;ts&8q}koV
vXJ(zSKVnOX?3az-pf(>JFf!px+d#q!xzSI&b!Yb$ZXNVIw`6z(^nlVh=Qng|7(tu9liE5anAK1Mwj$OL;NwHeJR$99|tp}Pe&5Zjr6V4?%A0X
S(%V_bN3|k5t&`T-
O4Jx}2`Swr`KUmRl0a^1lw~=BcV=1WRme*43Sj0qCJwryiYD8v`E&G1peu&bU>p#YLy&cNVu26H$Yg2{7B}}063^!|~Fn+}qR`o?bN7uw({E6;
D!#xq+_Pt>>cyyBFS73KV!Q31^wRWF&WnTp8)Gn=HleGQVh&N8<ity+$SE4|!@)<Oov4OS9yxrjKD0M^A_g~t11DRIbwu~0Wp6a^|E4uY9u1{W
ig4r88zSTs0TSKotVuHF|0cPtrmKeTHzCSw59Fs~mp*o~jGq+CVtx4OvxYFIB;^DLX#YjC)JY6(4Of;5iacWX}Q&S{Gf@+9M50z<+POvyI3V=7
ku#K^FPA^bTc5JG0*m68)$l8N}#V;_|VG|5+lMDL~CpS-ZKd-BH!j0ypHyq19*)Uoc8FzSqIWBC*$ruBJsU^(I<sm)Bp$M$wN)lxE^AX=b$xBK
-S(n|{V8VS}dqH`1Bl~>McP9bIZcPM!{W<)v0Tp!R6u<_zAu?K@8~^ghM|W?}=L>e77y_EGTJrBk4$pJ22@QUdGbUh*%#Ov4R%4IJtXcciNU>&
JpNFF?<AmRzI>NUolJ}_S@}1G4%IL?<rrmEHSm+zot1DbGq}ZJOzOf$7p*n=mx#p`m%`ejyeoR3ponCfj_Xjj$-
a$jBZe64P9W=b)004^jS<`o*a5k|uW-?(l`7gjQG%&JypJ05SV05xKc}EYYDD?@)cXHJEM8iq-
O(mj6mxxc9TtkXS#iX!?%5g1F0w&ClLKD~xo?{}m^YwP~{sf%d<ansk0dQTn{Nj55$<I)W+QtAP2`?S+h1T8ldw^F(lAte*W2>G8OZwWqyx%W*
`E?Mf2sfQm>3252nF*@<k;D1kE7SR4Stm<wW9g5MHpQ6I;E9MS%<@FCiJ5^rxNZg`QQz5YCBf&*O`vC>;dT6ILtX)#Q~+nO;M=b>Cf4M^1ZLVm
&WJ|R?MR$cmJ~+BhQd=6Jk)Z8K}!-d{_5VtXAf;7W09wJRV-^axKglRJGQe3^!4s-S5aotbtnzyj`OA;{FSOJ7m$Gz49RzD*5=`-
jKhxH1379CFxDyy-IYZsDRl|gUL=oE>QGCr1QkKXmWcq5oZm_*Q|t8Qw9Ml!?d<~hhU%6)F8bw+9^f(TOb)XVInx<tU-
1|S(WdP(4qZ2Ge(ndxtgt4nqVEZrTO1vS4&%EAz{!Gh%p)Vz@RvPqnM2{L5@nc4K((!ott<%TS7u=VnR9HpoBS;Db*T@8OB4GAM_8x4{ADwx)}
6h)p|a8Jfko<3gG)wLToEE34wq;}pPHvH@BR0|5lHVA@#SXOZ-1o+NqE>k$Q+%r=Y^nt88%Kfnxb-
CtdG8A)NxypUkfR*;kvMXBzb-S+b`2rGG4!@@KvHDPIi8V)x0ECzIE;4ikZ!2|2d4br*~SJ9-O;SR%u)2jaTV<Fe!y_XS-Xy*}?4^B6Fv_FI^E
!ZdW%$NLxJ37|#1?I^?b0f?!Lx`Jy(naU$5YY8|gmO677t=DKRjvZi%&!<Ws&EhVLJAJ1(zV=OiE%^6zF5r2P5?)2fJ*CqM9-
o_5VjUOYix3;sihDy_78mtXB`T7FW*_U975c$O;NNz|d`!aBItj8cX&9iiY+|MZadxsHHBB$c6(T!I{-l>X*8;`?fcn^HR?1gQnoU7C;j}y)i-
a!E=rW{EMuu9K6^~0A4RyQ(}<6wc$yuiy{*Fs3d-}bnmp=(_rPK+qH*|ieUeN{E>2P<0{h7Ffi^ULcy`Huqpa+a9>V{1C>furf=PumrlG-
aeWSr4~^pS2Pyt51Av1uE^X&Gh?8ch`>}Y|xKO-Y7}CE-sd0o)rurJ3&gs`)(|L9)z)7K?NvR16`W?fNB4p-
&m4th?}H5^`{C4@LOaBWO1DIr_T7gl4k%P;Q$p9yT^E+m4`R;wb`?<(LIyER^9qHh(Beo_Fnd@DQ{GcU;w}~H~_%$_hs+oXvAb-
Z_i|EV&LrJXyWugG2p*|z}3RU?a$pi47ezd*#<JBw*SOj!yu-xS6HQ0n@S|Tbtv(y9;b9LLA<fmlfJpsO&5-
%O%&{&9KSgGpwbj&#?|daW`|4=)7@-
0e?wm9JlYF~)mcK4Nz<hB=|E<~UA8D3C!cPhihjUf8))JNWhr$G5+_U44l~*nxB*q+YYlLL&ZDsEl?lsgF~3P)w1_<<F^*U>XAz(Sgy}Z%1pHM
S&bj2*Kdcv$f#IBThHZ6Vwo}8@YdYAF1-skXZRdxRZnhM{dF!pb;!+gx_2}wIeG&tzJfbo{ej-
#`;A#tP=I47h%|Mztn3GXISO^GS$P`Q}T(XZ6wG1am)We}QoXf3}rUpdZ$;;qYdj1&I`sm+6ZUuV@iYg(@V*+e&8A_QB`809yjUn6>PVVY!d4a
9yk`u%vv-JV?lC-kE^6GiH6_!=7J}0lG!&QhnWl>Szdu8prHY2S-
F7;GAQ(|XA+vBz*W^nJl{X+gSYt8Atm>KtXgfG_8LRY43QbhY5yMgb57WAKOqPeq;b%pvw^c*v4=cP)Dy*XWivrq;xO`EpEF)5eg@)$e`D7A61
)zySow{*h?RvzC&jL^SkBVRsE`PKIBdFm)tL7rnjL`uj}zF{)gTS$(bhlE@gz#tfWv-~v!7YV-cj*72}mUp>Zb!5%l+2i%ql8;2h@ndQv7189D
k7Q`ss_(V4vzvq`r=?-
a&NSJ5KQ%3T5%h4M2#;ud$8lvuyDEH8c;;tS9JBzihFEy?2!e_oaGNIxqRjQJ_|7TH?Z#LuzmZZtHUA&g7Za{4{yj%i^F4*9&p+zfp&i)MF^yx
pM3EFO(PB>nEO-tSy+=tuU)9g2zjkB&xWpCh>E{DFNOe$`K6SWO7<{`JWJco<r%+|Vb>e~YU9OK_nc^O^gVqY7B<wa%IKjm157w&A1;mPpCx$)
8JDaQJIUldRfT#(BV?d0(hi?cUq3oHj+E87zF7x&)qQP(Xo|>vMH5URy_AU-bGm{fI?pX8!7M+oKNTE2`IdhQcR(Xi7BPS%cM3gP;;kd$Dw7$`
g4gc_4SGxp`-
!WY2F!s5?HzW)w%Q=(;PF#6CTRW#_P+i8C8E43%TkmP*=t9ZJA7z9`b8I>EGS+_{u1i(T?>Y|{#<6I+oedea8&;32&TVU|ApE=rR|@N(W2u;J>
61&&8az;JhS{MXr|s)*u&QXllWAqcBsw=CUPnwGJ4;WFPTT981A9|SS{X(EssA?M7vI<&ew=Nm_O^zS6Ahx{ArqQHsO!}_<YYcO!^M4WaUkY_B
ZW(aFa<{0?6;w{btAW*I{MpR!-wO1uOU*!rW6zu+_)|knh+MmQVD?5rs0gzT=f@p@=ltPdYZ%Oh-k&p>6fe(G)xSSz=%nD-fx|!Ce?}h5QRjf3
0yE%ZV>6hn-P#(2*A}f^({{sJhKO@w2h(Z-
!Q?!32h9FED;PbsAqOLpXLnfb_w7#A3s7kqZ<Z}oaprUg5DsT?FvPG>(`7V`Zrv|o4}B3ry#f?D*ext7h#`mM!8`X=byFIbyWP{Sg2n=UIKB@t
h$Ox2_{|@EIz`w7Dlf5^JEmiWTaK@G$<<*oX0^PaY3J|sEKk@&)q&bsoQlUS>@&2F-<vT9W~6r-4wmS#mM`D|0C6UD}0*-
Kmq{x@8!z#pOx!>^REW=8QT+aRG%ZdLIut^77~<1_|^pq>O^H44K-
Pn5)D4<GqAhCO&7PNZ#qHqO|ODmzj@DNe#!7yc||!8M^$RWp?mSOnH`R&vha-
+uvQ0hTRH{9of(uELvMOfs*8=zGbh1^hGaR`+)(mg;QMZKLmzCl7z#5LjLP#iWfFcnyGk241)$H@?4kf6vmGPl02!Tlo1!cB2y3p{6{#&p%{H>
V2C@=?NSQ9@q#}|qefF9@qmJyQNHIzpo2$;X^%rv)5{V1xhSeEOWC;oR<2eUMCV&o8_;>?(l-
p^pwdqZjgiWv0gG<3`#G!2tXu`9n4lWbzKDRS8JXGR!ARAEJ4Yw9zukr;+1_8b(Dp&q)11go8Js4f_W42=Llit+r;63i>+v}~HehrN#JPN(9Xs
lp}b{*yk0A7eb4D$z-$y6<~9>AAq(+8oAP>?>DQxLI-
S6HTn^IaJ?1APVjG)dH^dF+KgNu+gaH^CJyJNmx_2_lc)r21kxAP|)o2uGQw6*jT@&ij5*&Qg*8K0!5p{0q537L>C7iSRk*>ubLE#SOR7Tz?5X
w?PAh{EC-4CE4zPef(;r@3&9T(!P_&UDyc*Ii_T(=pvg30|!fiGv@Z!6W-3;oy|E@Q~RIyM@}ip<3!YxT2;6g+@VSy8fonjU2=mblt)-
ci1JQ(Tl0`{m9YuNKkj}0^8EP8rBSFLbw_!<9wC8Nh$95;OjnIulQb1>F4&Nv*aEmA`twKVBig3IdbPsm4zP>a9*zY&9FT2A@P6lhnea~gs&Nx
5%`61U!gk!@N1hHQ@ZrRDdwAOzw+q|#6=eT|t4>@7y6czT0yJr9&Db$nWoMz=2S#@QvZjH!DFulfyu_H1kPDbhoKbw<^=EwPBA&X8BA8+A6HJ=
*hfOlW%AWGrusu3P^9+Xg+ja1~noUD#1Juz9>20RL65L~oFS#B5?DI$?1)iUiyyjz98P+S6L__!$u}_W`th(Kx13Wu=PAzMKyMV=6WNFVSjSZK
H!P3fAOP8VIdT4mTS^`}(2|ZM7Wk6G(bBev*`%aXi9bI>#%^;;?7xOu*mW7F3D@eJQIn{D;eVM@0byYCf{K>vJPe`oOuKjAquNy{=&K#U(px#2
Py){X@^<GgWq<ZFJZP0;46tCtg?WvNh0luJcIyYzCjY&>dam{Tf0b)dLn_1h!$n_X=ns_I;YE_O=2C|KBh49uXe5hU}P)x)^y{vyEY%x%kYGFo
eBO7+M!dB>V*Xs1xOTz{KH(2~p$~3j?>(nD(S^by9NslQE<rC){#8v<6rC@vT+1GUh4l<7f_Etf0%w_f|-
#4&7xKi+rE7lbvcH8efE)N<25d0T$#oWTl+0N199|r#mT@qF0>~L97JATp~HtJbu2_q-MODCdGNTZaLLLW@SibcBtKzd$Q>2k{bUoPFdG$pkg(
5uT|4kv!L<BYX4FZMxqj)KRZxS6)NA{aR>_x7gY=c-
gDTMe8`e)u}$OuUwZ!}BG2<*7TiNVg>U#ZQ9VuzlY!Q7}Ya^HEakx<GIT<J&I=lOgrd?rD@RO@}WGnV`D{kpeQIvOcvA@377Sv2}wvrI(Ul-
1P;(W6J>4=+GUr;PwioxBec47L6=LsR90w+D;04I$IVz%=#bVodbnCnVQf=BoQ`(Kk=zhUHo7huLY?u@O7@K&f)+EYAJbl7u`ch4|f7|E!r5FK
a<MC*90JIj+fL$8U!e6)_QVW!o)gyCE%(*$balH1rSHN5*{zx3j-
riF&vq7&9SJ6>Ep^bg`+30DOxw<L^5yn*i@Gh{Ld5O&eB30?n}j(1R(RpLSJP|@W`_8zZNa<SV#wEu@^1a9Y@l#v>}8V-
T!pgK5z1T_50y|64)NN>PLPXJ9uPpl`XwjpwUyobeI~*(dFnVE;RrtCsfNutL*IU{A|EQh!XR0a&Ra<kL<U1(Su9u3xV(<s5h(S*EwXNalbI*5
|-KR^hSzxg`|Fbi>(yxv(MCs2Y4_?!T5AYrrZ-Jx4Dn<!Byo&y8f-J9+5d-
QK6_6&3>;UxLn1M=QCXW4~D~_48^Z!L1#!q_>FK^^lPDK4Q_t*7ElH8mdOnc9gI=G%AFtymp1V>R5!swnXAo3_GbGWn4$`6yUxp6>#%Qv3&Bg;
+JrS^FSD9h3Zu&_<MlG;1&*VQHZtpvNI4wb^>D^4k#3`gY2#FJvSJJ9qgCuCV;PzqKY$>kdfD?@(6Wv>IM{iY=bb0fnNHV8URuPTJZ0i3!?MII
-d?@kb7sX<4JZaMo={?Sf`Hj|@&~rG+9gQ7ASE!52^l_#d2Ah;anm@{xF}vw-#zFbmC(tNG*`;|Xc6!)DIps>V-
xHDx@WL4adI*+GkGr=x#$k~US?qMJ>S4et+|YYmBY1}y*=7*07=K9prqvmgXX*&NRxU4+50F)Pec|x6}tD@U>}R$0EM5GA_}G6z?Ggd%r+r+<v
c*K6^~b<vftXX_Y+vSEOub_b}KIZNN}f+)~>y{8fM$LiLAfDbYt=yG>P=0>{M((K}F2s!xtZg63zR9=Q2G)PAg-hI~c9Id5ssqKQ0vw1F}@$T`
xq#0RXiBY^g?ejwVb_CXTKaM*qED1_OJGzYz{KUAt95RPQ4V>uhUMQQTXkG)~H#2ucd2Gu6^k+SX+R9cH(S4IE*NSFfe)4@>Me1)YAEwsvN&Zh
VJhlC%&C%vdPLc&<dG)&`~f=;dsbrVhjNHB6Y=FY2cc$FS{kLAWWx%ubLtz<VTb=PJr=83SNmVn(k%Bo);LNH;}tx|kywJW?kIPzk0{Y_9QP6`
ZQ?xOe9LJFLR0^FdYRkc<mWAUU9ygH0-;2+L0xOA^i252ge7dHnZ+O`lv?6xBz597Oy%cU%df7w5I%V~mA9(+3ITXZR-vr?5CU-
P1*a4b3aWq`g+7B_~R~R>!X9&Et4A1<PWuH^n?vuu{S>caNA8MV})l({{~;Rst(kkAn_r?7LYu+<H#gl)-
NFiElx~Lf_}`o(c0f?WH}kq(WGQ6J5V*qbsu_G$K)HC8~e<vK;lDjUCv8r(iVAx>x);ntTP?OX=k|7j6~Q2Se%Rw9c({RD#e%UwTh{)kvS#0on
4g9k7zbTVgB(k|jeJ>1!3NlMsaB1XZ<P;F~BG_E4|X;o#o+ao|WRv}oXJQXr!(Nt0xVt<dA{+7vJ7S$R9~;}mU!qtJ8TR<lDLH>gjf83Aeo@(r
C74fT_*S;hiF`TG$tA0p#@X=yMl>hWakl`5LEJ91)o>Ehs}oXEVDElV4lHhFo!oGk<`U-WRK5-
mvzalh0%H*4^vP*^YNKss*t=m+J77GsNxU$*%sQPM>#^!O&~nyVB@R|;)=Rt?;pB5U@=dhO`yZXwwY_Mzmpt%d(w!THP+I2N1O6mBe1?jj1TZm
NoHkFkuO3u65yS<A5pb(FivcYx(>`t0Fx3VMc~d>k-
mwI*%cz|`(`J=oQ6Fp;H9l^<zHA7xc2ohBbt$)dn5n(<Gz2=GN$sHPJs^&#o>r3*<ak~UF~d|A?On{imh!QZ#FEMkm5b|zhlM0^^Gd#&iBe+>}
H6uPj^9ABYT9UeN%^mxWT>!;=2SHzs}{eU8Tbn$Aq<>qh)c3MF~CH_h1eBP#U(f>L9R{2&eWn=pU&L6$7m%J`|yeIvsI*yO}TOGC?ie|roro^}
ate2SGCjqd3)B!x4v<HpvI)DZR0ATqS%kXa>=>Oe*UC`LD-4g}A3-%0NUgb2(L_tzDzxs6D-1Di~{I8;FY8X%CsprOn<B=-
01?X<=0JnDJc36d8oVC4WsYYFr{($-Z8Xw;-r%AU$?^tS^9k4<3GnT<CSd|JaRPTv>dQ4d&QRzMZf+n5GfIR*SOiHc-5CqmlI%-
}xd$vBt)et1v8l-$S1ycn>OP!*cKq}js!h@hyLHet0kmm>)t4NnZf=({yxFba!jF~xNx`9QV3u^4*N12Dhjo5-
=&VxuV$vCgrxItl678HJ1k98;`4vLjy+t$#{WYmvmU{}p>NuT_6VJ8>(Au2YRj&a#ZW{2qqePpVT*Fv)|-FTkPnFcfaY}@3%Y{g5a^-
qPJ@pDE;JYb16HcSsA71Val(IOmJvNt38!vD^jv1h-?j?v|k)=p^5ikGNPlgA7t;dVrJ>???+ia!O8&=BNZm_|&W-
bUnX(;W+9BmW$~^Ue<HX_fu*`b^iZG&so~-N_GS+dYXEDeV%JQ>gD^d9+V#-
Q29Z%q^(u20pX_0c%TLPhlr#vV66pPB>ouyVY+|l@KSv;eb=zUkze^|2nL5k)Not4~(jCCg&W%p)i*hgEPAJ2xvGKyr?}rC&MmH&*D2K8nJULC
pHN4D?=x13Aw})t&iC1UVggRy!F}j_+SSjAKGOGUl&E;1O2$Q0L6YskExPstM3ql7q)S?F=OO+_SE{esOr{O%WP<>%j=je-
?xD^&vM924Fiegl1PV9iosy}9$kh2gHf}RK?ivaGg^5l6S#178Tl6}iY~^>)=%Xk%*M#AT2B0%z?uE6^$>qWdd?h&@AQk5L*4vMPKnyhOY1GrW
rD?Fa7+7;kOiaT(&CEe>Fu#{wYlPjgt<i6tn@%_V1b%zqM{Di?c($<=|foO>IQu0SNNEf?OW;fW^ajnf+V&d8|!Sgy80Ktm4D<OIYpqbkuikA7
T|H>GL%KLWUv}cyXncri6t>Pd`QkUvF8o4T0X?xs;0=w%~<hRUQv`%k4jQ)MCB1rppu1+e8G?N3mw%$0hOl3B!W@yMZz9qlSf(&ee`Ajsk@tE(
VNSQ?pd1i#@ODHsk0gU<xryP!>n+kI}ikvk+!fF0v#qiQch<{H4cm{@Rdip?|4d>@aK3)2NEe$_MQfa6Lwd$#<@kD9}bta&cN?oEw8H^SvADPT
efD|w%<*NGnqR#uri~`ZdR0C7NtXLH~)BjV+RvdTzV1|6W|lDvNse{{6<WlB3r~hE!x0NM;S%x2$CD{L_?LLG=#FYRPw6VA8jU1%q)KKkzZT3L
pH6Vx$bnGMij7WD&hT%GzpXZa(%V?d}s2-oyT42V)RY@`~;#s&$~^$v^V}-
cQ$16NZ*=8q+oXC#6|RY8k(ZXGWA@$W7zTr1^ZV#b`Qe?#a&(S!LtpS8eR^5xtZkkp1NVRn8d{vE(C&npjf*I%rS2ndWt#WoKO~q;;>;;F(P)q
y=oylhWFiBjZzj>(cr}R*Pi3shuw+u>w~L-
vYzt=k2i)W`L_q>D~r$~KBi&%z^fGtq2yUBorNiqirlIy@=xe8HR0VZ4C_Zse?U;t(n6PiTWd4<U9=Frix#GTgNyt(1Xiey$*(g5H-
2I^m60psnlCIw7LOXKYAT{asnHtlkb^MT29bS@rSl%|^^U{}yK`g2@@sr9xrdGjQM#%U8mGH4alOL0t#hVN2m=&k88h`gK`OXz44IBCh=;u1=K
8^69r{{0A`wuSE?rLSsfRR!egd@P)`%IMX))a#_xdXNd2uU&5lr>!JcR0>m6rJW9DKqD;dpb&+i=diOfaePGyT~S8{0_uI=H|o28@9HsN&UcXl
Vp~vQkFhXEmJ;5YPJ3#&jy;dBtrGKTM34TFM72fDqa)HVcDL;X9pit9Z;NRWBezCMYAkx6I|Y7Tbpf`vXI`wGzyGNn0UECRH0*4dyR+W>1t?pX
pUcMcX<^uyS`e5y=;e{qgpu{o==0&<hT5>ewe#%NoA#f!nAD48qXXhP3M+Dw$$PY;*X_A8Oi%Kekt#WLWLAi_;PZ2P5WPq+sb;7qKI*@)+WsKC
w2MuHS*d!N|0<{~SAq6A#}W3{jfD1N$b?IZCchuuEfMz}okdG{dx*>c>uYGe!yhZDutt3fci02KZ0;$9{!CR*;RUpjvV2fi!qLx9XV^by6ThgX
0)FwKfy(idKS4fOue`ivffs2SgdcL3*WrW@^t<2fru(crDKQdK|Iv=A`eJ3XQ{g!8me}w9Wqhn3WUZpJ|Tv0kX@E&|MZEQXr(|CYtq2y8Tl2l%
5Z(h7Rh=MWcKbzrsiuG`DPI$xNZ~rw@Z{WiF@nKf?XW5#r6SP*T%YvzEeU-
!`gZe_M$v%UPRVV>eD>c=CFcI({ok^|60C{doFQi27JfA@0iHlHkSbH#x@oZF1mgS^Uqjxy!FcG52<CIGd9=c@hp;jSCYA?uNB*zF_~@pRdrR2
xf+P=h`>`0R6x9p?7wg(EMb##tHPjuj2A3+3!tMsaKGXXSZUbKZZw~xM7C$&?jF#B#md3;^t6(yC>Krmrgo&#tQ+1rVkH28oc!8BmYDnJbwk*q
DfCD_Z5x#m1^P^w(?A%h3N+@Fx^497rIcHp4da-p`11x|44Xt-
?%#<3B@T_0Jbw%8Epcx%FKA>!xt54XNnTsBWjRdSU}RnqZ*;y3GK6NA}QN%Yh45?qOumv+U1Ja$L)paawPAr1m)r1=V_yuV`O>qAT8E;-
V}AdrfY`b*;A>G6{&nLE(@qDcEE=il6E~GRpK83%*Y_ngCn@7{LUdftyrRmp5OKXZlQ2*und>E)D6s_8BS>&5Tl!gM_so2)6|E`93X{FX9|dmp
Fep2@b`@j_|dl<u+(ly^jx4yntf&@DwvK+WqSB4gta_$x_Z9@tx9~76sYIp6&5gyH2E5>e9g4+R*TIhqw(_2!`Q?zd`$K$0{b-
@Q7uJmgm$_XKRdoq1HEhbf`~}bj6@Noy_Z>MeO}(z0zJH?IS~@g`}q93bw2S;!lsPgrsYaDo)2B#aL{I|0q*<oN#?N0fj1eZS4seE+zFP-
0&3cRLmEeAJu4C<&oFTCh+R_598n4f9a%J@#4NKbM?UwhdAr|`GBoPtIRlsy3I(V<{uB0sT`RwbW%~W27OCC1bfp`GFK0f|(8HrW+MkS&*kF%b
<=X{}boSCj^KQDtdw97eZHoWsJYC8)4~L$)&Q(vO3{R{ukrsk44;Kg239gYw+%yg+B$SdleJ;7x0~_aPnmkKXHWp(@K1<9M-
^I{%%RNact205zq2`ebwf8jb@lH2M&0<SjF*ZVH3r0vQG={tvhrPgi?xQ2lv@~xMt%g*er);%(Phd(hYp^9+7x|($NNB1ui0~;@yoTwEjKZ4u_
A?*juuY7J-1$}WHNrWxR<iMUg>b@tm|Mp7gE_@C2JZ}jc98bB&6(}E>^sR1B@Bmq4&jAT`IV{Ue3-
cS8_|NU6wi7$MaPTgQc;(U#)Dk;i8_g%E*6WK1SigJl|;Xa&RkQv)i9S;x)FUf$=LOKln~@Zz+I)(bcoE1d6r+ITGNo*kvOWxh=#FOjZO1KNxp
aCQE@+17=E+b<L&yOQJEhm!NPagwiU!Z3X0jq&lt?<0W%Ov>JxDfQJNf_oZm1qr$`zOxXU$)h8$JqVvkmFT<Zd*MfqsPTs~<bhHEZRZjW0d6QR
yG4@>S`4KsiFg}2*1og%f)^gxd)1ky;l1mp5S<V_BC#9pv<b0kHc1e>^)gxK@)&xF_k8=(wWkJ*u;PrKX_nNQNrWBSOc(&O7ykCw#_WuVGeg^Q
ZE5uK-kH|a4YMF7duD&wP-*;C<x3szf*mtCu@l6r`B4?QMPs346jIIA%%FjO!Vjphse>bV2OPqPWu!t>(|eN#uB-
cpt+$U7p}<_c#Vzv1``)q?&<2p!U#Gtxi;8l>RO!W-L6Q1@k|xX>?$mZ-
tvm<{W>iz8Esla*V`lt;g*Q(X%UI8k05?EA0OrQfq5QHeVg*^H3h*1@{LpMJ-jZZQc^-
F`%mrU8?7=W0oFm;>Map2M!Yyc9u8pE<;RaOZ3&kDP;w|A?R2TJ$@1H>|9x3UiET)Wx+KaYJKI6hv{g3)RV~B;lnfX+v<r&AC$;m%fP`8zT|Mh
++MGf2gcnjiPH7XQYO|58kUFMZAuCCxt~lshX66t;Wz!Pm*;(U!OBMzzC3ntHG5|ZOa_9vt9fHL_jh%S9w3m_FW)?q*RehWJV0}F^@SK@r<Z1$
qU*pCMKq7q%|fjy_ChUhren%{ZvtX9(};+!;ootQ5w&u2!zQX;}|S1GhTLH%XN@H5p3z}>`E@OouuACCx1zPr`hU?#=`TJs?j`CHZS&TR0pDW`
XNw1lO4jViJR(8gm<Io&T7t(GJR0x7*hWxW%VZ?qejtAWb+wkD~KhcwzLF>Z_-WT)GC75@jkNSBWdd9IptyOZye!4@foW8fo#T|+tV{7AovUD=
!PR#NKMAeHz^@Lc!g5xbUaCnwiO$w!&lh1Ebh#|&0nlFU1{jvVnu0lLgi*Rd(iRbBZ7{tYp0-0jK$Fr7VW^R{YeVjZ~@)=^5@zf441{{?@z2-
Vw_$ycUl{EMTI(8jVQt$#h1!4ZTij{L^hPiz=2pRDO}F0$tCzS5uLm`r*CDchIUW*AaVDQ^^5%XI`(9QbtO3d%|!p|6?AFW(r2Q9Z;!A&8ET(h
Uoeau`jwpbWNIf}(t|e$PW2gVB$S99Xyh~&?bAcB_RUd#px!0a){~1WcBi>g2k-vwp@Akg>(Wm6-V-
@ojI89>GeTpQ>?|n`WCX9dlgzDy=(YS${t=>TK07WgH1)K$nf#<wcbu(XuaV&9n@3J;4+x4fVBkQA|FhZqfBo|P0sk-S_g_Q()mQl^)HdY5;<E
hvc>m0D^(P)C+`nkR`umXo%+B#ABqGv(Xzuv?6#vX@@F&F#@_%eS`0K0r>k;XnB!1}sKL@6NpXZ+)nf%GKjP?J2fb!Sf`D=^$Pc|&v|FGfw*A#
zk?fyvthWGC@djGm1f9+NMi5o`vA9Sw%KKwsZfq%kBk^S46@UQ>aztZnN!5t|7Ju<E+0|ouJClTK--S@X~%J8?*{{T*>Mac"""
_DATA = zipfile.ZipFile(io.BytesIO(zlib.decompress(base64.b85decode(''.join(_PAYLOAD.split())))))
def bundled(path: str) -> str:
    return _DATA.read(path).decode('utf-8')

edits: dict[Path, str] = {}

def original(p: str) -> str:
    path = ROOT / p
    if not path.is_file():
        raise RuntimeError('Required project file missing: ' + p)
    return path.read_text(encoding='utf-8')

def stage(p: str, data: str):
    edits[ROOT / p] = data

def replace_template(p: str, marker: str, source: str):
    current = original(p)
    if marker not in current:
        raise RuntimeError(f'Expected unique UI marker absent in {p}: {marker}')
    stage(p, bundled(source))

# Replace only chat logic and chat display markup (SCSS remains untouched).
replace_template('frontend/src/app/core/services/chat-store.ts', 'export class ChatStore',
                 'frontend/src/app/core/services/chat-store.ts')
replace_template('frontend/src/app/features/chat/chat-view/chat-view.ts', 'export class ChatView',
                 'frontend/src/app/features/chat/chat-view/chat-view.ts')
replace_template('frontend/src/app/features/chat/chat-view/chat-view.html', 'class="chat-messages"',
                 'frontend/src/app/features/chat/chat-view/chat-view.html')
replace_template('frontend/src/app/features/chat/models/chat-message.ts', 'export interface ChatMessage',
                 'frontend/src/app/features/chat/models/chat-message.ts')

# Update related existing tests; do not modify other tests.
for p in (
    'frontend/src/app/core/services/chat-store.spec.ts',
    'frontend/src/app/features/chat/chat-view/chat-view.spec.ts',
    'frontend/src/app/features/chat/chat-history/chat-history.spec.ts',
):
    original(p)
    stage(p, bundled(p))

# Add new service and its test; fail rather than clobber an independently edited version.
for p in (
    'frontend/src/app/core/services/chat-api.ts',
    'frontend/src/app/core/services/chat-api.spec.ts',
    'frontend/e2e/chat-backend.e2e.spec.ts',
    'desktop/electron/chat-ipc.cjs',
    'desktop/electron/chat-ipc.test.cjs',
):
    proposed = bundled(p)
    dest = ROOT / p
    if dest.is_file() and dest.read_text(encoding='utf-8') != proposed:
        raise RuntimeError('Existing file differs. Review manually: ' + p)
    stage(p, proposed)

# Existing Electron bridge typing: preserve all current entries in interface.
p = 'frontend/src/app/core/models/jarvis-desktop-api.d.ts'
s = original(p)
if 'chatApi?' not in s and 'chatApi(' not in s:
    needle = 'checkPrivateHealth():'
    if s.count(needle) != 1:
        raise RuntimeError('No known typed Electron API anchor in ' + p)
    pos = s.rfind('    };')
    if pos == -1:
        raise RuntimeError('Missing Window.jarvisDesktop interface end')
    s = s[:pos] + (
        "      chatApi?(request: import('../services/chat-api').ChatApiRequest): "
        "Promise<import('../services/chat-api').ChatApiResult>;\n"
    ) + s[pos:]
stage(p, s)

# In preload, add one IPC call without exposing ipcRenderer or the secret.
p = 'desktop/electron/preload.cjs'
s = original(p)
if 'chatApi:' not in s:
    pattern = r'(^[ \t]*checkPrivateHealth:[^\n]*\n)'
    hits = list(re.finditer(pattern, s, re.M))
    if len(hits) != 1:
        raise RuntimeError('Unknown preload expose API shape; refusing blind modification')
    at = hits[0].end()
    s = s[:at] + "  chatApi: (request) => ipcRenderer.invoke('jarvis:chat-api', request),\n" + s[at:]
stage(p, s)

# Register a narrow trusted-sender-only IPC handler in the existing main process.
p = 'desktop/electron/main.cjs'
s = original(p)
if 'registerChatIpc(' not in s:
    anchor = 'const jarvisWindow = createWindow();'
    if s.count(anchor) != 1 or 'isTrustedSender' not in s or 'ipcMain' not in s:
        raise RuntimeError('Electron main does not match known secure IPC shape; not modified')
    s = "const { registerChatIpc } = require('./chat-ipc.cjs');\n" + s
    s = s.replace(anchor,
        "// Chat: fixed HTTP endpoints, validated sender, token only in Electron main.\n"
        "    registerChatIpc(ipcMain, (event) => isTrustedSender(event, useBuiltUi));\n    " + anchor, 1)
stage(p, s)

# Keep existing security filter intact. Allow ROLE_JARVIS for chat only.
p = 'backend/src/main/java/pl/bawar/jarvis/security/ApiSecurityConfig.java'
s = original(p)
if '.requestMatchers("/api/chats", "/api/chats/**").hasAuthority("ROLE_JARVIS")' not in s:
    needle = '.anyRequest().denyAll()'
    if s.count(needle) != 1 or '.authorizeHttpRequests(' not in s:
        raise RuntimeError('Security chain differs: cannot verify denyAll anchor in ' + p)
    s = s.replace(needle,
        '.requestMatchers("/api/chats", "/api/chats/**").hasAuthority("ROLE_JARVIS")\n'
        '                ' + needle, 1)
# Statless custom header is not sent automatically by browsers. Exempt ONLY these routes from CSRF,
# while retaining CSRF for all other endpoints. Session token auth stays mandatory for chat.
if '.ignoringRequestMatchers("/api/chats"' not in s:
    if 'http.csrf(' in s:
        raise RuntimeError('Existing custom CSRF configuration requires manual review')
    needle = 'http.formLogin('
    if s.count(needle) != 1:
        raise RuntimeError('Unknown Spring Security HttpSecurity shape: ' + p)
    s = s.replace(needle,
        'http.csrf(csrf -> csrf.ignoringRequestMatchers("/api/chats", "/api/chats/**"));\n'
        '        ' + needle, 1)
stage(p, s)

# Flat PL/EN translation dictionary, preserve all existing keys.
keys = {
  'pl': {
    'chat.loading': 'Wczytywanie historii z bazy danych…',
    'chat.generating': 'Jarvis generuje odpowiedź…',
    'chat.backendConnected': 'Połączono z lokalnym backendem Jarvisa',
    'chat.backendUnavailable': 'Backend jest niedostępny. Uruchom Spring Boot i Electron.',
    'chat.authRequired': 'Brak autoryzacji. Uruchom Spring Boot i Electron z tą samą sesją.',
    'chat.requestFailed': 'Nie udało się wykonać operacji. Spróbuj ponownie.',
  },
  'en': {
    'chat.loading': 'Loading conversation history from the database…',
    'chat.generating': 'Jarvis is generating a reply…',
    'chat.backendConnected': 'Connected to the local Jarvis backend',
    'chat.backendUnavailable': 'Backend unavailable. Start Spring Boot and Electron.',
    'chat.authRequired': 'Unauthorized. Run Spring Boot and Electron with the same session.',
    'chat.requestFailed': 'The operation failed. Try again.',
  },
}
for lang, additions in keys.items():
    p = f'frontend/public/i18n/{lang}.json'
    content = json.loads(original(p))
    if not isinstance(content, dict):
        raise RuntimeError('Translation JSON is not a flat object: ' + p)
    content.update(additions)
    stage(p, json.dumps(content, ensure_ascii=False, indent=2) + '\n')

# Prevent accidentally committing personal backup copies.
p = '.gitignore'
if (ROOT / p).is_file():
    gi = original(p)
    if '/.jarvis-patch-backups/' not in gi:
        stage(p, gi.rstrip('\n') + '\n/.jarvis-patch-backups/\n')

# Every check has passed; now backup and commit changes.
changes = {p: value for p, value in edits.items() if not p.is_file() or p.read_text(encoding='utf-8') != value}
if not changes:
    print('SKIP: FE 11.4 already applied. No changes.')
    sys.exit(0)
backup = ROOT / '.jarvis-patch-backups' / ('fe-11-4-' + datetime.now().strftime('%Y%m%d-%H%M%S-%f'))
for path in changes:
    if path.is_file():
        target = backup / path.relative_to(ROOT)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, target)
for path, value in changes.items():
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(value, encoding='utf-8')
    print('PATCH:', path.relative_to(ROOT))
print('DONE. Backup of modified files:', backup.relative_to(ROOT))
print('NEXT: git diff; node --test desktop/electron/chat-ipc.test.cjs; npm run build')
