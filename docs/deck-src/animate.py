"""Add a fade slide transition and an automatic staggered fade-in of content shapes to every slide.
Shapes named bg-* and the layout's footer are left alone. Pure string insertion on the slide XML."""
import re, sys, zipfile, shutil, os
src = sys.argv[1]; dst = sys.argv[2]
tmp = dst + ".tmp"
zin = zipfile.ZipFile(src)
zout = zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED)
SHAPE = re.compile(r'<p:(sp|pic|graphicFrame|grpSp)\b.*?<p:cNvPr id="(\d+)" name="([^"]*)"', re.S)

def timing(ids):
    n = [100]
    def nid():
        n[0] += 1; return n[0]
    pars = []
    for i, sid in enumerate(ids):
        delay = i * 180
        node = "clickEffect" if i == 0 else "withEffect"
        pars.append(
            f'<p:par><p:cTn id="{nid()}" presetID="10" presetClass="entr" presetSubtype="0" fill="hold" grpId="0" nodeType="{node}">'
            f'<p:stCondLst><p:cond delay="{delay}"/></p:stCondLst><p:childTnLst>'
            f'<p:set><p:cBhvr><p:cTn id="{nid()}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn>'
            f'<p:tgtEl><p:spTgt spid="{sid}"/></p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr>'
            f'<p:to><p:strVal val="visible"/></p:to></p:set>'
            f'<p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="{nid()}" dur="450"/><p:tgtEl><p:spTgt spid="{sid}"/></p:tgtEl></p:cBhvr></p:animEffect>'
            f'</p:childTnLst></p:cTn></p:par>')
    build = "".join(f'<p:bldP spid="{sid}" grpId="0"/>' for sid in ids)
    return (
        '<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>'
        '<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>'
        '<p:par><p:cTn id="3" fill="hold"><p:stCondLst><p:cond delay="indefinite"/><p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond></p:stCondLst><p:childTnLst>'
        '<p:par><p:cTn id="4" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>'
        + "".join(pars) +
        '</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn>'
        '<p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>'
        '<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst>'
        '</p:seq></p:childTnLst></p:cTn></p:par></p:tnLst><p:bldLst>' + build + '</p:bldLst></p:timing>')

count = 0
for item in zin.infolist():
    data = zin.read(item.filename)
    if re.match(r"ppt/slides/slide\d+\.xml$", item.filename):
        xml = data.decode("utf8")
        ids = [sid for kind, sid, name in SHAPE.findall(xml) if not name.startswith("bg-")]
        # group bubble parts so they appear together: keep order, cap at 40 effects per slide
        ids = ids[:40]
        extra = '<p:transition spd="med"><p:fade/></p:transition>' + (timing(ids) if ids else "")
        if "<p:transition" in xml or "<p:timing" in xml:
            xml = re.sub(r"<p:transition.*?</p:transition>|<p:transition[^>]*/>", "", xml, flags=re.S)
            xml = re.sub(r"<p:timing>.*?</p:timing>", "", xml, flags=re.S)
        # insert after clrMapOvr (required element order: cSld, clrMapOvr, transition, timing, extLst)
        if "<p:clrMapOvr>" in xml or "<p:clrMapOvr/>" in xml:
            xml = re.sub(r"(<p:clrMapOvr>.*?</p:clrMapOvr>|<p:clrMapOvr/>)", lambda m: m.group(1) + extra, xml, count=1, flags=re.S)
        else:
            xml = xml.replace("</p:cSld>", "</p:cSld>" + extra, 1)
        data = xml.encode("utf8"); count += 1
    zout.writestr(item, data)
zout.close(); zin.close()
shutil.move(tmp, dst)
print(f"animated {count} slides")
