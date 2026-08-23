#!/usr/bin/env bash
# Gen-Z Hub — end-to-end API smoke test
set -u
B=${BASE:-http://127.0.0.1:3000}/api
H='-H Content-Type:application/json -H X-GenZ-Client:1'
PASS=0; FAIL=0
ck(){ if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "  ok   $1"; else FAIL=$((FAIL+1)); echo "  FAIL $1 (got '$2' want '$3')"; fi }
j(){ node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const o=JSON.parse(d);const v=$1;console.log(v===undefined?'':v)}catch(e){console.log('PARSE_ERR')}})"; }

rm -f /tmp/a.txt /tmp/b.txt /tmp/adm.txt
U1="qa_$RANDOM"; U2="qb_$RANDOM"

echo "== AUTH =="
code=$(curl -s -o /tmp/r1 -w '%{http_code}' -X POST $B/auth/signup $H -c /tmp/a.txt -d "{\"full_name\":\"QA One\",\"username\":\"$U1\",\"email\":\"$U1@t.io\",\"password\":\"passw0rd1\",\"dob\":\"2004-01-01\"}")
ck "signup user1" "$code" "200"
code=$(curl -s -o /tmp/r2 -w '%{http_code}' -X POST $B/auth/signup $H -c /tmp/b.txt -d "{\"full_name\":\"QA Two\",\"username\":\"$U2\",\"email\":\"$U2@t.io\",\"password\":\"passw0rd1\",\"dob\":\"2004-01-01\"}")
ck "signup user2" "$code" "200"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST $B/auth/signup $H -d "{\"full_name\":\"Dup\",\"username\":\"$U1\",\"email\":\"x$U1@t.io\",\"password\":\"passw0rd1\",\"dob\":\"2004-01-01\"}")
ck "duplicate username rejected" "$code" "409"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST $B/auth/signup $H -d "{\"full_name\":\"Kid\",\"username\":\"kid$RANDOM\",\"email\":\"kid$RANDOM@t.io\",\"password\":\"passw0rd1\",\"dob\":\"2020-01-01\"}")
ck "under-13 rejected" "$code" "400"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST $B/auth/signup $H -d "{\"full_name\":\"Weak\",\"username\":\"w$RANDOM\",\"email\":\"w$RANDOM@t.io\",\"password\":\"abc\",\"dob\":\"2000-01-01\"}")
ck "weak password rejected" "$code" "400"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST $B/auth/login $H -d "{\"identifier\":\"$U1@t.io\",\"password\":\"wrong\"}")
ck "bad login rejected" "$code" "401"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST $B/posts $H -d '{"content":"anon"}')
ck "unauth post blocked" "$code" "401"
code=$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/a.txt -X POST $B/posts -H 'Content-Type:application/json' -d '{"content":"no header"}')
ck "CSRF header required" "$code" "403"

ID1=$(curl -s -b /tmp/a.txt $B/auth/me -H X-GenZ-Client:1 | j 'o.user.id')
ID2=$(curl -s -b /tmp/b.txt $B/auth/me -H X-GenZ-Client:1 | j 'o.user.id')

echo "== ONBOARDING / HUBS =="
ck "join business" "$(curl -s -b /tmp/a.txt -X POST $B/me/hubs $H -d '{"hub":"business","join":true}' | j 'o.joined')" "true"
ck "join gaming" "$(curl -s -b /tmp/a.txt -X POST $B/me/hubs $H -d '{"hub":"gaming","join":true}' | j 'o.joined')" "true"
curl -s -b /tmp/a.txt -X PUT $B/me/interests $H -d '{"interest_ids":[1,2,3]}' >/dev/null
ck "complete onboarding" "$(curl -s -b /tmp/a.txt -X POST $B/me/onboarding/complete $H | j 'o.user.onboarded')" "true"

echo "== POSTS =="
P=$(curl -s -b /tmp/a.txt -X POST $B/posts $H -d '{"content":"QA hello #qatest @'"$U2"'","hub":"general","privacy":"public"}' | j 'o.post.id')
ck "create post" "$([ -n "$P" ] && echo yes)" "yes"
ck "hub gate (not joined)" "$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/b.txt -X POST $B/posts $H -d '{"content":"x","hub":"business"}')" "403"
PB=$(curl -s -b /tmp/a.txt -X POST $B/posts $H -d '{"content":"Looking for a co-founder","hub":"business","kind":"collab","topic":"Startups"}' | j 'o.post.id')
ck "business collab post" "$([ -n "$PB" ] && echo yes)" "yes"
PP=$(curl -s -b /tmp/a.txt -X POST $B/posts $H -d '{"content":"secret","privacy":"private"}' | j 'o.post.id')
ck "private post hidden from others" "$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/b.txt $B/posts/$PP -H X-GenZ-Client:1)" "404"
ck "empty post rejected" "$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/a.txt -X POST $B/posts $H -d '{"content":"  "}')" "400"
ck "edit own post" "$(curl -s -b /tmp/a.txt -X PATCH $B/posts/$P $H -d '{"content":"QA edited #qatest"}' | j 'o.post.content')" "QA edited #qatest"
ck "cannot edit other post" "$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/b.txt -X PATCH $B/posts/$P $H -d '{"content":"hack"}')" "403"
ck "cannot delete other post" "$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/b.txt -X DELETE $B/posts/$P -H X-GenZ-Client:1)" "403"
ck "react" "$(curl -s -b /tmp/b.txt -X POST $B/posts/$P/react $H -d '{"type":"fire"}' | j 'o.reaction_count')" "1"
ck "unreact toggles" "$(curl -s -b /tmp/b.txt -X POST $B/posts/$P/react $H -d '{"type":"fire"}' | j 'o.reaction_count')" "0"
C=$(curl -s -b /tmp/b.txt -X POST $B/posts/$P/comments $H -d '{"content":"nice one"}' | j 'o.comment.id')
ck "comment" "$([ -n "$C" ] && echo yes)" "yes"
ck "reply" "$(curl -s -b /tmp/a.txt -X POST $B/posts/$P/comments $H -d "{\"content\":\"thanks\",\"parent_id\":$C}" | j 'o.comment.parent_id')" "$C"
ck "comment count" "$(curl -s -b /tmp/a.txt $B/posts/$P/comments -H X-GenZ-Client:1 | j 'o.comments.length')" "2"
ck "repost" "$(curl -s -b /tmp/b.txt -X POST $B/posts/$P/repost $H -d '{"content":"look"}' | j 'o.post.repost_of')" "$P"
ck "save post" "$(curl -s -b /tmp/b.txt -X POST $B/posts/$P/save $H | j 'o.saved')" "true"
ck "saved list" "$(curl -s -b /tmp/b.txt $B/posts/saved -H X-GenZ-Client:1 | j 'o.posts.length')" "1"
ck "hashtag feed" "$(curl -s -b /tmp/a.txt $B/posts/hashtag/qatest -H X-GenZ-Client:1 | j 'o.posts.length>=1')" "true"
ck "mention notification" "$(curl -s -b /tmp/b.txt $B/notifications -H X-GenZ-Client:1 | j "o.notifications.some(n=>n.type==='mention')")" "true"

echo "== SOCIAL =="
ck "follow" "$(curl -s -b /tmp/a.txt -X POST $B/users/$ID2/follow $H | j 'o.following')" "true"
ck "unfollow" "$(curl -s -b /tmp/a.txt -X POST $B/users/$ID2/follow $H | j 'o.following')" "false"
curl -s -b /tmp/a.txt -X POST $B/users/$ID2/follow $H >/dev/null
ck "connect request" "$(curl -s -b /tmp/a.txt -X POST $B/users/$ID2/connect $H | j 'o.status')" "pending"
CID=$(curl -s -b /tmp/b.txt $B/users/me/connections -H X-GenZ-Client:1 | j 'o.incoming[0].connection_id')
ck "accept connection" "$(curl -s -b /tmp/b.txt -X POST $B/users/connections/$CID/respond $H -d '{"action":"accept"}' | j 'o.status')" "accepted"
ck "connections list" "$(curl -s -b /tmp/a.txt $B/users/me/connections -H X-GenZ-Client:1 | j 'o.connections.length')" "1"
ck "search people" "$(curl -s -b /tmp/a.txt "$B/search?type=people&q=$U2" -H X-GenZ-Client:1 | j 'o.users.length')" "1"
ck "search no results" "$(curl -s -b /tmp/a.txt "$B/search?q=zzzzqqqnothing" -H X-GenZ-Client:1 | j 'o.users.length+o.posts.length')" "0"
ck "suggestions" "$(curl -s -b /tmp/a.txt $B/users/suggestions -H X-GenZ-Client:1 | j 'Array.isArray(o.users)')" "true"

echo "== MESSAGING =="
CV=$(curl -s -b /tmp/a.txt -X POST $B/conversations/start $H -d "{\"user_id\":$ID2}" | j 'o.conversation_id')
ck "start conversation" "$([ -n "$CV" ] && echo yes)" "yes"
ck "send message" "$(curl -s -b /tmp/a.txt -X POST $B/conversations/$CV/messages $H -d '{"body":"yo"}' | j 'o.message.body')" "yo"
ck "recipient sees message" "$(curl -s -b /tmp/b.txt $B/conversations/$CV/messages -H X-GenZ-Client:1 | j 'o.messages.length')" "1"
ck "outsider blocked from convo" "$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/adm.txt $B/conversations/$CV/messages -H X-GenZ-Client:1)" "401"
ck "empty message rejected" "$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/a.txt -X POST $B/conversations/$CV/messages $H -d '{"body":"  "}')" "400"

echo "== GROUPS / COMMUNITIES / EVENTS =="
GID=$(curl -s -b /tmp/a.txt -X POST $B/groups $H -d '{"name":"QA Private Group","privacy":"private","description":"qa","rules":"be nice"}' | j 'o.group.id')
ck "create group" "$([ -n "$GID" ] && echo yes)" "yes"
ck "join private -> pending" "$(curl -s -b /tmp/b.txt -X POST $B/groups/$GID/join $H | j 'o.status')" "pending"
ck "non-member cannot post" "$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/b.txt -X POST $B/posts $H -d "{\"content\":\"x\",\"group_id\":$GID}")" "403"
ck "private group feed hidden" "$(curl -s -b /tmp/b.txt $B/groups/$GID/feed -H X-GenZ-Client:1 | j 'o.restricted')" "true"
ck "approve member" "$(curl -s -b /tmp/a.txt -X POST $B/groups/$GID/members/$ID2 $H -d '{"action":"approve"}' | j 'o.ok')" "true"
ck "member can post" "$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/b.txt -X POST $B/posts $H -d "{\"content\":\"in group\",\"group_id\":$GID}")" "200"
ck "non-admin cannot manage" "$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/b.txt -X POST $B/groups/$GID/members/$ID1 $H -d '{"action":"remove"}')" "403"
ck "role assign" "$(curl -s -b /tmp/a.txt -X POST $B/groups/$GID/members/$ID2 $H -d '{"action":"moderator"}' | j 'o.ok')" "true"
ck "leave group" "$(curl -s -b /tmp/b.txt -X POST $B/groups/$GID/leave $H | j 'o.ok')" "true"
CM=$(curl -s -b /tmp/a.txt $B/communities -H X-GenZ-Client:1 | j 'o.communities[0].id')
ck "join community" "$(curl -s -b /tmp/a.txt -X POST $B/communities/$CM/join $H | j 'o.joined')" "true"
ck "community post" "$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/a.txt -X POST $B/posts $H -d "{\"content\":\"hi community\",\"community_id\":$CM}")" "200"
ck "non-member community post blocked" "$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/b.txt -X POST $B/posts $H -d "{\"content\":\"x\",\"community_id\":$CM}")" "403"
ck "leave community" "$(curl -s -b /tmp/a.txt -X POST $B/communities/$CM/join $H | j 'o.joined')" "false"
EV=$(curl -s -b /tmp/a.txt -X POST $B/events $H -d "{\"title\":\"QA Event\",\"starts_at\":$(( $(date +%s) * 1000 + 86400000 )),\"mode\":\"online\",\"hub\":\"business\"}" | j 'o.event.id')
ck "create event" "$([ -n "$EV" ] && echo yes)" "yes"
ck "rsvp interested" "$(curl -s -b /tmp/b.txt -X POST $B/events/$EV/rsvp $H -d '{"status":"interested"}' | j 'o.event.interested_count')" "1"
ck "save event" "$(curl -s -b /tmp/b.txt -X POST $B/events/$EV/save $H | j 'o.saved')" "true"
ck "non-host cannot delete event" "$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/b.txt -X DELETE $B/events/$EV -H X-GenZ-Client:1)" "403"

echo "== STORIES =="
ck "stories list" "$(curl -s -b /tmp/a.txt $B/stories -H X-GenZ-Client:1 | j 'Array.isArray(o.stories)')" "true"
ck "story needs media" "$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/a.txt -X POST $B/stories $H -d '{"caption":"no media"}')" "400"

echo "== BLOCK / REPORT =="
ck "block user" "$(curl -s -b /tmp/b.txt -X POST $B/users/$ID1/block $H | j 'o.blocked')" "true"
ck "blocked hides posts" "$(curl -s -b /tmp/b.txt $B/posts/feed -H X-GenZ-Client:1 | j "o.posts.filter(p=>p.user_id==$ID1).length")" "0"
ck "blocked cannot message" "$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/a.txt -X POST $B/conversations/$CV/messages $H -d '{"body":"hi"}')" "403"
ck "unblock" "$(curl -s -b /tmp/b.txt -X POST $B/users/$ID1/block $H | j 'o.blocked')" "false"
ck "report post" "$(curl -s -b /tmp/b.txt -X POST $B/reports $H -d "{\"target_type\":\"post\",\"target_id\":$P,\"reason\":\"Spam\",\"details\":\"qa\"}" | j 'o.ok')" "true"
ck "invalid report reason" "$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/b.txt -X POST $B/reports $H -d '{"target_type":"post","target_id":1,"reason":"Bogus"}')" "400"

echo "== ADMIN =="
ck "non-admin blocked from stats" "$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/a.txt $B/admin/stats -H X-GenZ-Client:1)" "403"
curl -s -o /dev/null -X POST $B/auth/login $H -c /tmp/adm.txt -d '{"identifier":"admin@genzhub.app","password":"AdminGenz2026"}'
ck "admin login" "$(curl -s -b /tmp/adm.txt $B/auth/me -H X-GenZ-Client:1 | j 'o.user.role')" "admin"
ck "admin stats" "$(curl -s -b /tmp/adm.txt $B/admin/stats -H X-GenZ-Client:1 | j 'typeof o.users')" "number"
ck "admin no password leak" "$(curl -s -b /tmp/adm.txt $B/admin/users -H X-GenZ-Client:1 | j "JSON.stringify(o).includes('password')")" "false"
RID=$(curl -s -b /tmp/adm.txt "$B/admin/reports?status=open" -H X-GenZ-Client:1 | j 'o.reports[0].id')
ck "resolve report" "$(curl -s -b /tmp/adm.txt -X POST $B/admin/reports/$RID $H -d '{"action":"remove_content"}' | j 'o.ok')" "true"
ck "removed post hidden" "$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/a.txt $B/posts/$P -H X-GenZ-Client:1)" "404"
ck "suspend user" "$(curl -s -b /tmp/adm.txt -X POST $B/admin/users/$ID2/status $H -d '{"status":"suspended"}' | j 'o.status')" "suspended"
ck "suspended session killed" "$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/b.txt -X POST $B/posts $H -d '{"content":"x"}')" "401"
ck "suspended cannot login" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $B/auth/login $H -d "{\"identifier\":\"$U2@t.io\",\"password\":\"passw0rd1\"}")" "403"
curl -s -b /tmp/adm.txt -X POST $B/admin/users/$ID2/status $H -d '{"status":"active"}' >/dev/null
ck "admin cannot self-suspend" "$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/adm.txt -X POST $B/admin/users/1/status $H -d '{"status":"suspended"}')" "400"

echo "== SETTINGS / PASSWORD =="
ck "change password wrong current" "$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/a.txt -X POST $B/auth/change-password $H -d '{"current":"nope","next":"newpass123"}')" "400"
ck "change password ok" "$(curl -s -b /tmp/a.txt -X POST $B/auth/change-password $H -d '{"current":"passw0rd1","next":"newpass123"}' | j 'o.ok')" "true"
ck "login with new password" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $B/auth/login $H -d "{\"identifier\":\"$U1@t.io\",\"password\":\"newpass123\"}")" "200"
TK=$(curl -s -X POST $B/auth/forgot $H -d "{\"email\":\"$U1@t.io\"}" | j 'o.dev_token')
ck "reset password" "$(curl -s -X POST $B/auth/reset $H -d "{\"token\":\"$TK\",\"password\":\"resetpass1\"}" | j 'o.ok')" "true"
ck "reset token single use" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $B/auth/reset $H -d "{\"token\":\"$TK\",\"password\":\"resetpass2\"}")" "400"
ck "theme/lang settings" "$(curl -s -b /tmp/adm.txt -X PATCH $B/me/settings $H -d '{"theme":"dark","lang":"bn"}' | j 'o.user.lang')" "bn"
curl -s -b /tmp/adm.txt -X PATCH $B/me/settings $H -d '{"theme":"system","lang":"en"}' >/dev/null

echo "== STATIC =="
for f in / /css/app.css /js/core.js /js/components.js /js/views-hubs.js; do
  ck "serve $f" "$(curl -s -o /dev/null -w '%{http_code}' ${BASE:-http://127.0.0.1:3000}$f)" "200"
done
ck "unknown api 404 json" "$(curl -s -o /dev/null -w '%{http_code}' $B/does-not-exist -H X-GenZ-Client:1)" "404"
ck "spa fallback" "$(curl -s -o /dev/null -w '%{http_code}' ${BASE:-http://127.0.0.1:3000}/anything)" "200"

echo
echo "RESULT: $PASS passed, $FAIL failed"
[ $FAIL -eq 0 ]
