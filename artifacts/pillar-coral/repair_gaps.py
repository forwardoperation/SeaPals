"""Continuous vector substrate and shaded trunk connections for the coral."""
import json, math
from pathlib import Path
from collections import defaultdict, deque
from PIL import Image, ImageDraw, ImageChops, ImageFilter
from trace import contours, cubics, evaluate, path_data

ROOT=Path(__file__).parent
photo=Image.open(ROOT/'source.png').convert('RGB'); W,H=photo.size
def points(s):return [list(map(float,p.split(','))) for p in s.split()]
def curve_polygon(pts,closed=True):
    return [tuple(evaluate(b,j/8)) for b in cubics(pts,closed) for j in range(8)]

# The outline pass deliberately stopped at fused bases. This substrate follows
# the connected colony behind those separate fronts, preserving sky notches.
core=points('672,250 691,236 721,237 741,240 746,271 747,300 765,319 784,321 795,302 809,278 826,228 843,232 848,283 850,310 861,332 874,351 880,363 871,391 861,411 853,432 854,472 855,508 855,535 867,567 886,591 908,606 914,642 920,674 925,697 918,722 925,741 936,757 932,787 926,818 928,845 937,865 932,891 930,916 918,934 904,941 881,932 867,939 850,942 835,945 809,944 785,940 764,935 751,922 738,908 714,895 697,903 682,914 660,908 649,898 646,873 631,855 614,840 597,829 582,813 572,799 555,790 544,779 548,762 559,747 576,731 587,709 586,682 579,653 570,630 564,610 562,582 568,551 577,524 582,504 586,488 596,489 605,471 610,447 611,424 605,399 606,375 615,350 634,330 649,310 657,291 668,277')
coverage=Image.new('L',(W,H));cd=ImageDraw.Draw(coverage)
cd.polygon(curve_polygon(core),fill=255)
for c in contours:cd.polygon(curve_polygon(c['points'],c['closed']),fill=255)

# The small root lobes outside the long-pillar outlines are part of the colony.
root=points('817,753 831,737 851,727 871,708 889,706 903,717 915,731 931,733 942,743 946,756 940,770 935,786 934,804 929,820 929,836 936,847 944,856 946,866 940,879 934,891 934,906 937,917 930,931 920,940 904,944 892,939 880,937 866,945 852,947 837,945 823,945 810,948 798,945 784,942 770,937 759,930 750,919 737,901 727,885 721,868 731,846 748,828 767,809 787,791 803,773')
cd.polygon(curve_polygon(root),fill=255)
for extra in [
    '595,498 595,487 596,479 600,474 605,476 608,482 607,489 610,497 609,510 604,519 598,514',
    '862,479 862,465 865,451 869,437 875,432 877,440 873,451 870,463 867,476',
    '632,719 646,715 665,718 685,706 699,711 706,729 711,748 700,765 678,781 650,776 631,755',
]:cd.polygon(curve_polygon(points(extra)),fill=255)

# Remove only strongly blue water connected to the outside of the silhouette.
# Deep interior coral crevices stay filled with vector shadow.
pix=photo.load(); cm=coverage.load()
water=Image.new('L',(W,H));wm=water.load()
for y in range(65,950):
    for x in range(493,951):
        r,g,b=pix[x,y]
        if b>max(70,r*1.48) and g>r*1.32:wm[x,y]=255
coverage=ImageChops.subtract(coverage,water)
coverage=coverage.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))

# Fill small isolated pinholes. Real gaps between the branches connect to sky.
cp=coverage.load();seen=set()
for y in range(70,948):
    for x in range(495,949):
        if cp[x,y] or (x,y) in seen:continue
        queue=[(x,y)];seen.add((x,y));area=[];touch=False
        while queue:
            a,b=queue.pop();area.append((a,b))
            if a in (495,948) or b in (70,947):touch=True
            for q in ((a-1,b),(a+1,b),(a,b-1),(a,b+1)):
                if 495<=q[0]<=948 and 70<=q[1]<=947 and q not in seen and not cp[q]:seen.add(q);queue.append(q)
        if not touch and len(area)<250:
            for a,b in area:cp[a,b]=255

def rdp(ps,eps):
    if len(ps)<3:return ps
    a,b=ps[0],ps[-1];dx=b[0]-a[0];dy=b[1]-a[1];den=math.hypot(dx,dy)
    ds=[abs(dy*(p[0]-a[0])-dx*(p[1]-a[1]))/den if den else math.dist(a,p) for p in ps]
    m=max(ds);j=ds.index(m)
    if m<=eps:return [a,b]
    return rdp(ps[:j+1],eps)[:-1]+rdp(ps[j:],eps)

def loops_from_mask(mask):
    p=mask.load();adj=defaultdict(list);box=mask.getbbox()
    for y in range(box[1],box[3]):
        for x in range(box[0],box[2]):
            if not p[x,y]:continue
            if not p[x,y-1]:adj[(x,y)].append((x+1,y))
            if not p[x+1,y]:adj[(x+1,y)].append((x+1,y+1))
            if not p[x,y+1]:adj[(x+1,y+1)].append((x,y+1))
            if not p[x-1,y]:adj[(x,y+1)].append((x,y))
    loops=[]
    while adj:
        start=next(iter(adj));q=start;loop=[q]
        while True:
            nxt=adj[q].pop()
            if not adj[q]:del adj[q]
            q=nxt
            if q==start:break
            loop.append(q)
        area=abs(sum(loop[j][0]*loop[(j+1)%len(loop)][1]-loop[(j+1)%len(loop)][0]*loop[j][1] for j in range(len(loop)))/2)
        if area<3:continue
        k=max(range(len(loop)),key=lambda j:math.dist(loop[0],loop[j]))
        simplified=rdp(loop[:k+1],.65)[:-1]+rdp(loop[k:]+[loop[0]],.65)[:-1]
        loops.append(simplified)
    return loops

loops=loops_from_mask(coverage)
origin=[min(x for loop in loops for x,y in loop),min(y for loop in loops for x,y in loop)]
substrate_path=' '.join('M '+' L '.join(f'{x-origin[0]:.2f} {y-origin[1]:.2f}' for x,y in loop)+' Z' for loop in loops)
patches=[]
def patch(name,s,colors):
    p=points(s);x=min(q[0] for q in p);y=min(q[1] for q in p)
    patches.append({'name':name,'x':x,'y':y,'path':path_data([[a-x,b-y] for a,b in p],True),'colors':colors,'points':p})

# These rear surfaces are overlapped by the existing 75 front-facing pillars.
patch('Crown shared trunk','678,244 697,219 719,223 741,235 749,273 757,300 748,333 721,355 682,360 657,338 660,305', ['#26332e','#454638','#7c714e'])
patch('Upper right continuous shaft','807,206 827,211 846,210 855,253 858,299 872,337 872,383 852,430 822,452 799,430 789,380 794,329', ['#303d34','#54503b','#ae9158'])
patch('Right branch collar','844,331 868,337 885,347 885,368 871,400 855,416 839,411 833,387', ['#3d4233','#76603d','#b39965'])
patch('Upper left continuous trunks','624,312 647,309 669,326 686,359 687,409 673,468 651,506 621,523 602,493 609,451 602,412 606,368', ['#25332d','#3b463a','#636750'])
patch('Central upper recessed spine','704,326 738,318 772,332 790,361 786,410 778,459 774,500 751,546 724,539 704,502 714,448 708,396', ['#182723','#30372c','#5b5740'])
patch('Middle center shadow crevice','734,365 758,359 772,388 770,423 754,459 753,506 752,553 734,570 721,547 728,503 733,465 728,424', ['#0d1916','#17221d','#353b2d'])
patch('Left rear lower trunk','584,477 606,471 626,492 637,540 631,594 627,642 614,687 590,698 579,668 571,625 565,585 571,548', ['#152722','#293c30','#50513b'])
patch('Left middle fused tissue','615,490 645,474 671,510 675,565 669,622 655,683 639,722 615,744 596,718 604,681 608,624 605,570', ['#22362e','#3c4938','#62654a'])
patch('Middle right rear connecting trunk','804,408 829,399 852,423 862,464 857,508 863,548 858,592 848,639 841,686 815,713 789,688 795,638 800,595 798,548 794,505', ['#454a34','#756b44','#b1975e'])
patch('Central rear broad pillar continuation','768,479 786,473 810,494 813,533 801,572 780,615 765,651 746,674 729,652 734,620 746,589 748,548', ['#263329','#454532','#81754d'])
patch('Central deep lower crevice','721,543 739,529 752,558 752,603 760,638 752,684 750,728 746,773 731,813 711,822 696,785 700,746 710,703 710,662 706,615', ['#101b17','#20271b','#453d25'])
patch('Central lower buried stems','729,634 755,622 783,636 794,679 795,724 786,759 771,793 745,821 714,831 691,808 688,777 705,741 714,700', ['#28352b','#494b35','#8a794e'])
patch('Lower left colony foot','554,733 579,724 606,730 636,748 658,779 682,817 680,852 661,871 636,861 613,838 587,820 563,800 547,780', ['#192b24','#303b2c','#665a3a'])
patch('Front central basal necks','650,769 678,752 709,764 731,799 750,830 746,865 735,895 711,910 682,915 652,898 638,874 640,834', ['#2a3b2e','#554e34','#9f8555'])
patch('Lower right fused ridge','838,624 867,620 892,633 906,665 911,701 925,730 936,757 930,792 918,822 892,843 857,827 833,801 819,770 820,728', ['#5e5031','#91713e','#cfad69'])
patch('Right basal gold connecting tissue','860,730 886,715 910,727 932,742 940,765 931,794 925,823 933,849 939,870 928,891 914,909 887,912 867,899 851,871 842,839 841,803', ['#695132','#a8874d','#d4b77c'])
patch('Front golden root foundation','773,820 806,798 838,801 864,821 886,846 903,870 920,893 926,917 914,937 887,936 864,941 842,945 817,944 791,940 770,927 754,902 750,873', ['#3b3c28','#806537','#bc9658'])
patch('Left small branch joint','595,498 595,487 596,479 600,474 605,476 608,482 607,489 610,497 609,510 604,519 598,514', ['#27372d','#524e36','#a18b58'])
patch('Right small branch continuation','859,480 861,461 865,447 869,434 875,431 877,440 873,451 870,466 867,479', ['#585136','#8b764b','#c5a15e'])
patch('Recessed roots beneath central needle','673,716 692,711 709,730 718,752 711,773 694,790 673,784 659,763 662,740', ['#15261e','#343720','#64532f'])
patch('Root hollow beneath front left pillar','604,792 619,781 642,792 653,813 648,832 633,846 615,835 600,813', ['#15261e','#283021','#51442b'])
patch('Front lower root hollow','706,854 726,845 745,859 757,883 748,906 734,914 716,901 701,880', ['#263020','#40391f','#786038'])
patch('Right basal shadow fold','858,786 873,775 889,784 897,806 892,829 887,851 876,869 861,862 850,841 852,815', ['#4c3c22','#72542d','#a17c46'])

data={'substrate':{'name':'Continuous colony silhouette','x':origin[0],'y':origin[1],'path':substrate_path,'colors':['#182a25','#273329','#4c452c','#8e713e']},'patches':patches}
(ROOT/'gap-repair.json').write_text(json.dumps(data,indent=2),encoding='utf-8')
coverage.save(ROOT/'continuous-coverage.png')

# Vector construction preview; solid lower-layer coverage is checked separately.
under=Image.new('RGB',(W,H));up=under.load()
def hexrgb(s):return tuple(int(s[i:i+2],16) for i in (1,3,5))
def color_at(colors,t):
    cs=[hexrgb(c) for c in colors];t=max(0,min(.999999,t))*(len(cs)-1);j=int(t);q=t-j
    return tuple(round(cs[j][k]*(1-q)+cs[j+1][k]*q) for k in range(3))
box=coverage.getbbox()
for y in range(box[1],box[3]):
 for x in range(box[0],box[2]):up[x,y]=color_at(data['substrate']['colors'],(x-540)/390)
for c in patches:
 mask=Image.new('L',(W,H));ImageDraw.Draw(mask).polygon(curve_polygon(c['points']),fill=255)
 mp=mask.load();b=mask.getbbox()
 for y in range(b[1],b[3]):
  for x in range(b[0],b[2]):
   if mp[x,y]:up[x,y]=color_at(c['colors'],(x-b[0])/(b[2]-b[0]))
repaired=photo.copy();repaired.paste(under,(0,0),coverage)
# The opaque coverage of the prior 75 shaded fronts.
original_shaded=Image.open(ROOT/'shaded-preview.png').convert('RGB')
oldmask=Image.new('L',(W,H));od=ImageDraw.Draw(oldmask)
from trace import occlusion
allmasks=[]
for c in contours:
 m=Image.new('L',(W,H));ImageDraw.Draw(m).polygon(curve_polygon(c['points'],c['closed']),fill=255);allmasks.append(m)
for i,c in enumerate(contours):
 m=allmasks[i].copy()
 for o in occlusion.get(i+1,[]):m=ImageChops.subtract(m,allmasks[o-1])
 oldmask=ImageChops.lighter(oldmask,m)
repaired.paste(original_shaded,(0,0),oldmask)
repaired.crop((490,65,955,955)).resize((697,1335)).save(ROOT/'gap-repair-preview.png')
isolated=Image.new('RGB',(W,H),(219,225,228));isolated.paste(repaired,(0,0),coverage)
isolated.crop((490,65,955,955)).resize((697,1335)).save(ROOT/'gap-repair-isolated.png')
print(json.dumps({'substrateLoops':len(loops),'anchors':sum(len(p) for p in loops),'connectingPatches':len(patches),'coveragePixels':sum(1 for p in coverage.getdata() if p)}))
