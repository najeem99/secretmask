set -e
export SECRETMASK_HOME=$(mktemp -d)
CLI=$(pwd)/src/cli.js
P=$(mktemp -d); cd $P
git init -q; git config user.email t@t; git config user.name t
mkdir -p src/main/resources src/main/java
cat > src/main/resources/application.yml <<Y
spring:
  datasource:
    url: jdbc:oracle:thin:@db:1521/XE
    username: app
    password: Claude123
aws:
  access-key: AKIAABCDEFGHIJKLMNOP
  secret-key: wJalrXUtnFEMIK7MDENGbPxRfiCY
kafka:
  sasl-password: \${KAFKA_PWD}
Y
cat > src/main/java/A.java <<J
class A { String apiKey = "sk-ant-abcdefghijklmnopqrstuvwxyz12"; }
J
git add -A; git commit -qm init
git config filter.secretmask.clean "node \"$CLI\" clean"; git config filter.secretmask.smudge cat
printf '*.yml filter=secretmask\n*.java filter=secretmask\n' > .git/info/attributes
node $CLI mask .
echo "--- masked yml"; cat src/main/resources/application.yml
echo "--- git status after mask:"; git status --porcelain; echo "(end)"
# simulate Claude copying a token + real code edit
TOK=$(grep ' password' src/main/resources/application.yml | awk '{print $2}')
echo "class B { String pw = \"$TOK\"; }" > src/main/java/B.java
echo "--- git diff of A.java with claude edit"; sed -i 's/class A {/class A { int x;/' src/main/java/A.java; git diff --stat; echo "--- yml diff (should be empty):"; git diff src/main/resources/application.yml
node $CLI unmask .
echo "--- B.java restored:"; cat src/main/java/B.java
grep -q Claude123 src/main/resources/application.yml && grep -q '\${KAFKA_PWD}' src/main/resources/application.yml && echo PASS
