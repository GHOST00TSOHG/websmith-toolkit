# Intro reveal spec (from @hrstwt reference video, study only; make our own original version)
- On load: dark blank canvas; center avatar pops (spring, ~0.5s) and a swarm of ~80 colorful cursor "agents" bursts radially.
- 1-3s: agents "build" the page: cyan bounding boxes with corner handles + monospace class labels (div.flex) draw over real DOM elements as they slide/fade into place (staggered ease-out).
- Bottom pill HUD shows counts ("80 agents • 1932 layers").
- Handoff: real HTML/CSS is usable immediately; agents keep drifting (boids/flocking) as ambient life; on scroll, IntersectionObserver flashes boxes on new sections.
- Tech: DOM content + one canvas overlay (pointer-events:none), boxes from getBoundingClientRect each frame.
- Our twist idea: the agents are Websmith's helpers assembling the toolkit cards; HUD shows live counts (skills / animations / installers). Original look, no borrowed brand, not a copy.
