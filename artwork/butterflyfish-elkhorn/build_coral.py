"""Editable, photo-traced elkhorn coral, original photograph coordinates 1280x853.

Three independently named coral masses retain the visible crop and occlusions.
No geometry is inferred behind the fish. Texture is deterministic vector art.
"""
import math
import random


REGIONS = {
    'Background antler plate': [
        (686,331),(696,323),(704,331),(713,321),(722,319),(725,304),(737,301),
        (746,313),(753,310),(764,307),(772,318),(787,302),(802,301),(808,289),
        (820,292),(825,322),(832,324),(837,297),(847,285),(857,280),(866,272),
        (880,272),(889,278),(886,289),(870,290),(867,313),(876,323),(881,347),
        (896,348),(906,338),(916,342),(921,358),(935,366),(932,380),(948,379),
        (954,393),(961,396),(966,411),(980,417),(986,437),(1001,440),(1013,457),
        (1028,470),(1020,485),(1003,491),(981,486),(965,482),(950,474),(930,477),
        (916,470),(904,480),(889,476),(872,487),(854,485),(840,495),(823,502),
        (808,503),(792,491),(783,474),(766,463),(747,452),(728,433),(712,423),
        (702,395),(694,379)
    ],
    'Overhead canopy': [
        (672,0),(1280,0),(1280,422),(1268,408),(1260,390),(1242,384),(1235,368),
        (1227,354),(1218,339),(1217,316),(1204,306),(1209,288),(1191,280),
        (1179,273),(1167,269),(1158,257),(1143,263),(1133,246),(1118,246),
        (1113,232),(1100,239),(1092,226),(1081,225),(1079,212),(1065,209),
        (1051,196),(1038,193),(1028,181),(1014,178),(1002,170),(988,168),
        (978,158),(961,158),(950,147),(934,151),(926,139),(910,136),(899,130),
        (885,126),(872,124),(859,114),(844,111),(831,100),(817,100),(804,88),
        (788,90),(777,80),(763,76),(750,69),(738,56),(727,52),(719,42),
        (703,39),(698,24),(687,22),(680,11)
    ],
    'Foreground branches and base': [
        (0,704),(20,704),(29,697),(35,713),(47,704),(59,713),(73,701),(85,702),
        (90,679),(100,661),(111,660),(117,646),(129,650),(139,635),(151,642),
        (159,627),(171,629),(178,614),(189,618),(191,636),(202,635),(208,653),
        (214,659),(222,648),(226,630),(237,631),(244,642),(250,659),(259,658),
        (269,646),(279,642),(289,656),(289,670),(303,671),(312,655),(314,640),
        (329,635),(338,647),(331,666),(346,675),(361,664),(373,651),(377,630),
        (389,619),(396,624),(392,647),(408,652),(419,647),(430,633),(444,627),
        (447,609),(458,607),(469,613),(474,630),(489,625),(494,610),(509,599),
        (522,600),(530,613),(546,613),(558,602),(572,607),(589,597),(602,605),
        (616,601),(626,612),(635,601),(648,606),(662,597),(674,612),(688,609),
        (704,598),(714,607),(729,594),(742,594),(751,578),(761,575),(775,588),
        (788,584),(799,573),(814,576),(826,564),(821,550),(816,535),(815,521),
        (823,511),(835,514),(839,500),(851,489),(861,495),(869,511),(878,497),
        (889,499),(897,513),(891,532),(905,530),(916,518),(932,515),(939,506),
        (952,505),(959,491),(970,494),(982,480),(993,481),(1002,468),(1016,472),
        (1027,461),(1039,472),(1048,469),(1060,476),(1065,487),(1081,488),
        (1088,505),(1097,502),(1107,516),(1122,517),(1133,507),(1146,510),
        (1152,525),(1165,531),(1170,519),(1182,525),(1188,544),(1200,542),
        (1209,553),(1222,542),(1236,548),(1245,535),(1260,540),(1269,528),
        (1280,535),(1280,853),(0,853)
    ],
}


def rounded_path(points, rounding=.30):
    """Gently rounded scallops preserve broad plate topology."""
    prev = points[-1]
    curr = points[0]
    start=(curr[0]+(prev[0]-curr[0])*rounding,curr[1]+(prev[1]-curr[1])*rounding)
    out=[f'M {start[0]:.2f} {start[1]:.2f}']
    for i,c in enumerate(points):
        p=points[i-1]; n=points[(i+1)%len(points)]
        if c[0] in (0,1280) or c[1] in (0,853):
            out.append(f'L {c[0]:.2f} {c[1]:.2f}')
            continue
        entry=(c[0]+(p[0]-c[0])*rounding,c[1]+(p[1]-c[1])*rounding)
        leave=(c[0]+(n[0]-c[0])*rounding,c[1]+(n[1]-c[1])*rounding)
        out.append(f'L {entry[0]:.2f} {entry[1]:.2f} Q {c[0]} {c[1]} {leave[0]:.2f} {leave[1]:.2f}')
    return ' '.join(out)+' Z'


CORAL_GEOMETRY={name: rounded_path(points) for name,points in REGIONS.items()}
CORAL_GEOMETRY['silhouette']=' '.join(CORAL_GEOMETRY.values())


def coral_defs():
    return '''
    <linearGradient id="coral-back" x1="0" y1="0" x2="0.7" y2="1">
      <stop stop-color="#f3d294"/><stop offset=".20" stop-color="#bd8d50"/>
      <stop offset=".57" stop-color="#946431"/><stop offset="1" stop-color="#443923"/>
    </linearGradient>
    <linearGradient id="coral-canopy" x1="0" y1="0" x2="0.6" y2="1">
      <stop stop-color="#b87921"/><stop offset=".31" stop-color="#8e551c"/>
      <stop offset=".62" stop-color="#634115"/><stop offset="1" stop-color="#38290f"/>
    </linearGradient>
    <linearGradient id="coral-foreground" x1="0.2" y1="0" x2="0.6" y2="1">
      <stop stop-color="#d5a150"/><stop offset=".24" stop-color="#a96c26"/>
      <stop offset=".52" stop-color="#86581f"/><stop offset=".79" stop-color="#603d16"/>
      <stop offset="1" stop-color="#322c1a"/>
    </linearGradient>
    <linearGradient id="coral-light" x1="0" y1="0" x2="0.75" y2="1">
      <stop stop-color="#fff2c1"/><stop offset=".46" stop-color="#eac177"/>
      <stop offset="1" stop-color="#b08341"/>
    </linearGradient>
    '''


def p(name,d,fill,stroke=None,sw=1,opacity=1):
    s=f'<path id="{name}" d="{d}" fill="{fill}"'
    if stroke: s+=f' stroke="{stroke}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round"'
    if opacity!=1: s+=f' opacity="{opacity}"'
    return s+'/>'


def inside(x,y,poly):
    result=False
    j=len(poly)-1
    for i,(px,py) in enumerate(poly):
        qx,qy=poly[j]
        if (py>y)!=(qy>y) and x<(qx-px)*(y-py)/(qy-py)+px: result=not result
        j=i
    return result


def rosette(x,y,r,elongation=1,angle=0):
    points=[]
    for i in range(12):
        a=(i/12)*2*math.pi
        rr=(r if i%2==0 else r*.65)*(1+.17*math.sin(x*.8+y*.5+i*2.7))
        dx=math.cos(a)*rr*elongation;dy=math.sin(a)*rr*.80
        points.append((x+dx*math.cos(angle)-dy*math.sin(angle),y+dx*math.sin(angle)+dy*math.cos(angle)))
    return 'M '+' L '.join(f'{a:.1f} {b:.1f}' for a,b in points)+' Z'


def texture_layers():
    rng=random.Random(7827)
    texture=[]; light=[]; shadows=[]
    for region_i,(name,poly) in enumerate(REGIONS.items()):
        tex={};hi={};sh={};white={};grain={}
        minx=int(min(v[0] for v in poly)); maxx=int(max(v[0] for v in poly))
        miny=int(min(v[1] for v in poly)); maxy=int(max(v[1] for v in poly))
        # Scatter uneven colonies freely across the plate; a sparse mix of
        # large radial cups and crowded tiny corallites avoids textile rows.
        colonies=[]
        for _ in range(int((maxx-minx)*(maxy-miny)/112)):
            x0=rng.uniform(minx+5,maxx-5); y0=rng.uniform(miny+5,maxy-5)
            colony_size=rng.choices([1,2,3,5],[.35,.34,.24,.07])[0]
            density=.65+.20*math.sin(x0/39+y0/48)+.14*math.cos(x0/71-y0/27)
            if rng.random()>density: continue
            for member in range(colony_size):
                angle=rng.uniform(0,math.tau);distance=rng.uniform(0,14) if member else 0
                colonies.append((x0+math.cos(angle)*distance,y0+math.sin(angle)*distance))
        for x,y in colonies:
                if not inside(x,y,poly) or not inside(x-4,y-3,poly) or not inside(x+4,y+3,poly): continue
                size=rng.triangular(.7,5.6,1.5) if region_i else rng.triangular(1,5.7,2)
                tile=(int(x//160),int(y//130))
                for field in (tex,hi,sh,white,grain): field.setdefault(tile,[])
                angle=rng.uniform(-1.1,.3);stretch=rng.uniform(.85,1.7)
                if not inside(x+size*stretch,y+size,poly): stretch=1
                tex[tile].append(rosette(x,y,size,stretch,angle))
                sh[tile].append(f'M {x-size*.66:.1f} {y+1:.1f} Q {x:.1f} {y+size*1.5:.1f} {x+size*.95:.1f} {y+size*.3:.1f}')
                # Only partial lit cup rims, with varied lengths and directions.
                if rng.random()<.76:
                    hi[tile].append(f'M {x-size*.7:.1f} {y+size*.25:.1f} Q {x-size:.1f} {y-size:.1f} {x+size*.45:.1f} {y-size*.7:.1f}')
                if rng.random()<.35:
                    hi[tile].append(f'M {x+size*.2:.1f} {y-size*.9:.1f} L {x+size*1.05:.1f} {y-size*.1:.1f}')
                # Fine central septa make larger cups read as radial corallites.
                if size>3.4 and rng.random()<.75:
                    for ray in range(rng.randint(3,5)):
                        a=angle+ray*math.tau/5
                        dx=math.cos(a)*size*stretch;dy=math.sin(a)*size*.8
                        hi[tile].append(f'M {x+dx*.35:.1f} {y+dy*.35:.1f} L {x+dx*.8:.1f} {y+dy*.8:.1f}')
                # Pale irregular polyps congregate along sunlit growth crests.
                oncrest=(region_i==0 and y<365) or (region_i==2 and y<720-.155*x+22*math.sin(x/80))
                if oncrest and rng.random()<.42:
                    length=rng.uniform(3.5,7.5)
                    tipx=x+rng.uniform(-3,3);tipy=y-length
                    if inside(tipx,tipy,poly):
                        white[tile].append(f'M {x:.1f} {y+1:.1f} Q {x-1:.1f} {y-length*.6:.1f} {tipx:.1f} {tipy:.1f} M {x:.1f} {y-length*.35:.1f} l -2.6 -2.4 M {x:.1f} {y-length*.5:.1f} l 2.4 -1.5')
                # Tiny granular flecks between cups vary surface frequency.
                for _ in range(rng.randrange(3)):
                    dx=x+rng.uniform(-8,8);dy=y+rng.uniform(-8,8)
                    if inside(dx+2,dy+2,poly) and inside(dx-2,dy-2,poly):
                        grain[tile].append(f'M {dx:.1f} {dy:.1f} l {rng.uniform(.4,1.5):.1f} {rng.uniform(-1,1):.1f}')
        for tile,paths in tex.items():
            label=f'{name.replace(" ","_")}-patch-{tile[0]:02d}-{tile[1]:02d}'
            texture.append(p(label+'-polyp-cups',' '.join(paths),['#865b2e','#ad7735','#b5803d'][region_i],opacity=.82))
            light.append(p(label+'-calcareous-rims',' '.join(hi[tile]),'none',['#ffe6b0','#d9ac63','#efd4a1'][region_i],.8, [.75,.49,.57][region_i]))
            if white[tile]: light.append(p(label+'-white-growth-tips',' '.join(white[tile]),'none','#fff1cf',.72,.70))
            if grain[tile]: light.append(p(label+'-limestone-grain',' '.join(grain[tile]),'none','#d8b275',.8,.49))
            shadows.append(p(label+'-cup-shadows',' '.join(sh[tile]),'none','#382512',1.1,.48))
    return ''.join(texture),''.join(light),''.join(shadows)


def build_coral_layers():
    structure=''.join(p(name.replace(' ','_'),CORAL_GEOMETRY[name],f'url(#{grad})','#594222',1) for name,grad in zip(REGIONS,['coral-back','coral-canopy','coral-foreground']))
    planes=[]
    planes += [
        p('Background-antler-upper-lit-plate','M 698 341 Q 723 318 742 326 Q 780 335 807 314 L 818 350 Q 838 367 848 317 L 861 289 L 875 282 L 863 329 Q 868 365 890 363 Q 911 355 924 381 L 945 396 Q 906 385 895 408 Q 861 390 836 394 Q 798 385 779 380 Q 736 385 712 364 Z','url(#coral-light)',opacity=.84),
        p('Background-plate-undercut','M 710 376 Q 741 402 772 394 Q 798 385 820 401 Q 844 421 870 406 Q 903 404 930 430 L 972 474 L 945 467 Q 923 476 904 467 L 870 481 L 835 488 Q 806 511 788 479 Q 764 454 737 441 L 715 419 Z','#594526',opacity=.67),
        p('Background-right-antler-face','M 883 371 Q 909 364 925 386 Q 946 399 956 417 L 989 448 L 1007 474 Q 978 475 958 459 L 923 430 Q 908 402 883 395 Z','#c69b61',opacity=.68),
        p('Canopy-facing-ridge','M 694 0 L 912 0 Q 924 46 978 71 Q 1014 94 1073 108 Q 1085 134 1133 158 Q 1131 180 1171 195 Q 1180 233 1219 254 L 1240 339 Q 1208 307 1185 285 Q 1164 257 1140 249 Q 1098 223 1069 203 Q 1035 178 1003 170 L 929 141 L 863 115 L 810 90 L 753 65 L 703 29 Z','#9b6323',opacity=.70),
        p('Canopy-interior-umbra','M 962 0 L 1280 0 L 1280 416 Q 1241 381 1225 330 Q 1206 285 1162 256 Q 1176 183 1119 129 Q 1041 88 1014 49 Z','#4d300f',opacity=.58),
        p('Foreground-diagonal-sunlit-ridge','M 0 724 Q 109 725 186 679 Q 207 692 239 685 Q 295 713 354 681 Q 406 671 451 635 Q 491 651 534 625 L 562 618 L 592 613 L 619 624 Q 670 633 715 613 Q 784 632 827 583 Q 874 563 920 551 Q 970 531 1021 492 L 1059 499 L 1078 524 Q 990 558 940 593 Q 889 618 841 629 Q 793 655 738 659 Q 675 681 626 677 Q 563 683 514 713 Q 439 738 365 742 Q 295 766 221 779 L 134 817 L 31 841 L 0 849 Z','url(#coral-light)',opacity=.78),
        p('Foreground-broad-plate-face','M 129 797 Q 269 743 366 743 Q 464 729 533 706 Q 631 670 722 675 Q 820 663 896 625 Q 920 673 1002 691 Q 1092 713 1167 678 L 1280 635 L 1280 786 Q 1180 822 1087 792 Q 1029 774 990 767 Q 943 750 912 738 Q 856 747 827 779 Q 774 789 733 827 L 716 853 L 182 853 Z','#8f5d20',opacity=.64),
        p('Foreground-low-underside','M 0 836 Q 208 849 340 785 Q 431 768 514 747 Q 599 725 677 711 Q 741 704 809 683 Q 872 677 899 698 Q 941 726 987 739 Q 1079 779 1171 758 L 1280 729 L 1280 853 L 942 853 Q 907 807 860 796 Q 808 794 777 829 L 757 853 L 0 853 Z','#3a2d18',opacity=.59),
        p('Foreground-right-raised-plate','M 891 557 Q 940 531 973 513 Q 1000 490 1028 488 Q 1050 477 1061 500 L 1082 518 L 1111 533 L 1141 526 L 1160 547 L 1180 544 L 1207 567 L 1234 557 L 1260 548 L 1280 550 L 1280 679 Q 1184 740 1094 696 Q 1044 684 1009 660 Q 962 629 949 603 L 920 588 Z','#936025',opacity=.78),
        p('Foreground-antler-light-tips','M 823 533 L 828 519 L 840 534 L 852 503 L 862 527 L 879 511 L 887 521 L 880 546 L 900 542 L 916 531 L 928 529 L 919 548 L 888 565 L 855 575 L 834 559 Z','#edc784',opacity=.86),
    ]
    contours=[
        p('Background-growth-grooves','M 716 357 Q 756 380 798 362 M 819 337 Q 821 374 844 383 M 858 306 Q 850 362 872 391 M 895 383 Q 924 401 953 442 M 741 398 Q 783 433 825 430 M 797 472 Q 830 447 853 440','none','#6e522c',2,.59),
        p('Canopy-broad-plate-folds','M 724 6 Q 776 53 841 62 Q 904 84 931 109 M 800 6 Q 837 30 888 34 Q 930 34 969 55 M 928 10 Q 939 51 1005 71 Q 1071 94 1093 132 M 1102 173 Q 1157 187 1179 240 M 1201 186 Q 1217 242 1244 264','none','#3c2b13',4,.69),
        p('Foreground-branch-separation','M 10 824 Q 142 812 236 763 Q 309 741 388 731 M 390 779 Q 455 759 515 741 Q 599 724 657 706 M 582 649 Q 631 662 683 646 M 705 686 Q 780 675 823 652 Q 879 637 910 612 M 904 576 Q 936 609 966 638 Q 997 673 1049 689 M 937 725 Q 1007 747 1078 765 Q 1154 784 1259 741','none','#513916',4,.67),
        p('Foreground-growth-grooves','M 77 783 Q 161 766 207 736 M 158 817 Q 237 782 298 780 M 325 800 Q 406 783 459 763 M 478 826 Q 551 781 616 768 M 560 843 Q 608 813 671 792 M 700 789 Q 748 760 802 742 M 768 832 Q 812 779 853 770 M 966 585 Q 984 633 1024 650 M 1034 572 Q 1062 616 1115 635 M 1137 587 Q 1161 633 1219 636','none','#ba873c',2.2,.46),
    ]
    highlights=[
        p('Background-limestone-tips','M 701 334 L 717 329 M 728 311 Q 733 304 739 309 M 764 316 L 770 323 M 794 310 L 804 306 M 813 300 L 817 315 M 846 289 L 856 285 M 866 280 L 879 279 M 899 350 L 910 346 M 922 372 L 928 375 M 948 400 L 955 410','none','#fff1c5',3.4,.85),
        p('Canopy-scattered-edge-light','M 705 33 L 718 43 M 733 50 L 746 60 M 762 69 L 777 74 M 798 86 L 813 91 M 849 106 L 863 111 M 909 131 L 923 135 M 960 151 L 975 155 M 1034 185 L 1047 192 M 1116 238 L 1129 241 M 1159 263 L 1173 273','none','#d4a660',1.6,.73),
        p('Foreground-lit-branch-crests','M 95 677 L 103 668 M 121 655 L 129 658 M 148 649 L 157 646 M 179 628 L 186 630 M 227 641 L 234 643 M 274 654 L 281 660 M 317 650 L 327 645 M 381 635 L 387 630 M 445 621 L 454 616 M 498 615 L 509 607 M 560 615 L 571 616 M 614 612 L 625 620 M 736 608 L 746 601 M 755 586 L 761 585 M 820 522 L 832 527 M 848 501 L 855 500 M 876 510 L 884 510 M 942 514 L 950 513 M 979 489 L 987 488 M 1011 483 L 1022 479 M 1108 526 L 1119 527 M 1154 535 L 1163 542 M 1224 556 L 1234 558','none','#fff0bc',3.4,.94),
    ]
    texture,polyp_light,polyp_shadow=texture_layers()
    return {
        '01 Branch silhouettes': '<g id="Coral-01-Branch-silhouettes">'+structure+'</g>',
        '02 Gold and umber planes': '<g id="Coral-02-Gold-and-umber-planes">'+''.join(planes)+'</g>',
        '03 Corallite cups and polyps': '<g id="Coral-03-Corallite-cups-and-polyps">'+texture+'</g>',
        '04 Shadow contours': '<g id="Coral-04-Shadow-contours">'+''.join(contours)+polyp_shadow+'</g>',
        '05 Limestone and sunlight highlights': '<g id="Coral-05-Limestone-and-sunlight-highlights">'+polyp_light+''.join(highlights)+'</g>',
    }


if __name__=='__main__':
    from pathlib import Path
    layers=build_coral_layers()
    svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 853" width="1280" height="853"><defs>'+coral_defs()+'</defs>'+''.join(layers.values())+'</svg>'
    out=Path(__file__).with_name('elkhorn-coral-editable.svg');out.write_text(svg,encoding='utf-8')
    print(f'Wrote {out} ({len(svg):,} characters), {len(layers)} organized layers')
