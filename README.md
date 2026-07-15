# PIXEL LAB 배포 가이드

## 이 폴더 구조
```
index.html          ← 메인 페이지 (반드시 최상위에 있어야 함)
avatar.html
paint.html
game.html
game-mole.html
game-pacman.html
game-chess.html
css/style.css
js/*.js
```

## 404가 뜨는 대표적인 이유와 해결법

1. **저장소에 파일이 실제로 올라가지 않음**
   - GitHub 저장소 페이지에서 `index.html`이 최상위(루트)에 보이는지 확인하세요.
   - 폴더(`site/`, `pixel-lab/` 등) 안에 넣고 push 했다면, 그 폴더까지 들어가야만 `index.html`이 보입니다. 이 경우 GitHub Pages는 루트의 `index.html`을 찾으므로 404가 납니다.
   - **해결**: 이 zip을 풀면 나오는 파일들을 저장소의 **루트 경로**에 그대로 push 하세요. (즉 `index.html`이 저장소 최상위에 있어야 합니다.)

2. **GitHub Pages 설정이 켜져 있지 않음**
   - 저장소 → **Settings → Pages**
   - Source를 `Deploy from a branch`로 설정
   - Branch를 `main` (또는 사용 중인 브랜치), 폴더는 `/ (root)`로 설정 후 Save
   - 저장 후 실제 반영까지 1~2분 정도 걸릴 수 있습니다.

3. **주소 끝에 파일명이 잘못 붙어있음**
   - 프로젝트 사이트 주소는 보통 `https://아이디.github.io/저장소이름/` 형태입니다.
   - `index.html`을 주소 끝에 직접 붙일 필요는 없습니다 (`.../저장소이름/index.html`도 되지만, `.../저장소이름/`만으로 접속되어야 정상입니다).

4. **대소문자 불일치**
   - GitHub Pages 서버는 대소문자를 구분합니다. `Index.html`처럼 대문자가 섞이면 인식하지 못하니 파일명은 정확히 `index.html`, `style.css` 등 소문자로 맞춰야 합니다. (이 프로젝트의 모든 파일명은 이미 소문자로 통일되어 있습니다.)

## 배포 순서 (요약)
1. GitHub에서 새 저장소 생성 (예: `pixel-lab`)
2. 이 zip 압축을 풀고 나온 모든 파일/폴더를 저장소 루트에 추가 후 커밋 & 푸시
   ```
   git init
   git add .
   git commit -m "pixel lab site"
   git branch -M main
   git remote add origin https://github.com/아이디/pixel-lab.git
   git push -u origin main
   ```
3. GitHub 저장소 → Settings → Pages → Source: `main` 브랜치 / `/ (root)` 설정 → Save
4. 1~2분 후 `https://아이디.github.io/pixel-lab/` 접속 확인

## 페이지 구성
- `index.html` : 다크/라이트 토글, 픽셀 애니메이션, 3개 메뉴 버튼
- `avatar.html` : 메이플스토리 형식 3등신 전신 아바타 커스터마이징
- `paint.html` : 도트 그림판 (브러시 두께 1~10px 세분화)
- `game.html` : 미니게임 선택 (두더지 / 팩맨 / 체스)
- `game-mole.html` : 두더지 게임
- `game-pacman.html` : 팩맨 (복합 미로 + 워프 터널 + 다중 유령 + 파워펠릿)
- `game-chess.html` : 체스 (정식 규칙 - 캐슬링, 앙파상, 프로모션, 체크메이트 판정 포함)

모든 페이지는 순수 HTML/CSS/JS로 만들어져 있어 별도의 빌드 과정 없이 그대로 정적 호스팅(GitHub Pages)에 올릴 수 있습니다.
