window.onload = function () {
    var game;
    var preload = function () {
        game.load.spritesheet("ship", "assets/ship.png", 32, 32);
        game.load.spritesheet("puff", "assets/puff.png", 32, 32);
        game.load.spritesheet("missile", "assets/missile.png", 32, 32);
        game.load.spritesheet("enemy", "assets/enemy.png", 32, 32);
        game.load.spritesheet("shield", "assets/shield.png", 32, 32);
        game.load.spritesheet("explode", "assets/explode.png", 32, 32);
    }

    var player;

    var create = function () {
        game.stage.backgroundColor = "black";
        player = game.add.sprite(10, 10, "ship");
        player.anchor = new Phaser.Point(0.5, 0.1);
        player.animations.add("idle", [1, 2], 2);
        player.animations.add("forward", [3, 4, 5], 20);
        player.velocity = new Phaser.Point(0, 0);
    }

    var cooldowns = {
        missile: 0,
        enemySpawn: 0
    };

    var update = function () {
        for (var cd in cooldowns) {
            if (cooldowns[cd] != 0) cooldowns[cd]--;
        }
        if (game.input.keyboard.isDown(Phaser.Keyboard.LEFT)) {
            player.rotation -= 0.12;
        }
        if (game.input.keyboard.isDown(Phaser.Keyboard.RIGHT)) {
            player.rotation += 0.12;
        }
        player.velocity.multiply(0.92, 0.92);
        player.x += player.velocity.x;
        player.y += player.velocity.y;

        if (game.input.keyboard.isDown(Phaser.Keyboard.UP)) {
            player.velocity.add(Math.sin(player.rotation) * 0.9, -Math.cos(player.rotation) * 0.9);
            player.animations.play("forward", null, true);
        }
        else player.animations.play("idle", null, true);

        if (game.input.keyboard.isDown(Phaser.Keyboard.SPACEBAR) && cooldowns.missile == 0) {
            fire(player.x, player.y, player.rotation, function (missile) {
                enemies.forEach(function (enemy) {
                    if (missile.destroyPhase) return;
                    if (Phaser.Point.distance(enemy, missile) <= 16) {
                        hit(missile, enemy);
                    }
                });
            });
            cooldowns.missile = 5;
        }

        if (cooldowns.enemySpawn == 0) {
            spawnEnemy();
            cooldowns.enemySpawn = 200;
        }
    }

    var missiles = [];
    var enemies = [];

    var fire = function (x, y, angle, cb, tag) {
        if (x <= 0 || y <= 0 || x >= game.width || y >= game.height) return;
        var puff = game.add.sprite(x, y, "puff");
        puff.anchor = new Phaser.Point(0.5, 0.5);
        puff.scale = new Phaser.Point(1, 1);
        puff.rotation = angle;
        puff.animations.add("go", [0, 1, 2, 3, 4, 5, 6], 30);
        puff.animations.play("go");
        puff.animations.currentAnim.killOnComplete = true;

        var missile = game.add.sprite(x, y, "missile");
        missile.cleanUp = function () {
            missile.destroy();
            if (missiles.indexOf(missile) === -1) return;
            missiles.splice(missiles.indexOf(missile), 1);
        }
        missile.tag = tag;
        missile.anchor = new Phaser.Point(0.5, 0.5);
        missile.rotation = angle;
        missile.animations.add("fly", [0, 1], 10);
        missile.animations.play("fly", null, true);
        missile.velocity = new Phaser.Point(0, 0);
        missiles.push(missile);
        missile.update = function () {
            angle += Math.random() * 0.1 - 0.05;
            missile.rotation = angle;
            missile.velocity = new Phaser.Point(Math.sin(angle) * 5, -Math.cos(angle) * 5);
            var cell = spatialHash[Math.floor(missile.x / 10)][Math.floor(missile.y / 10)];
            cell.splice(cell.indexOf(missile), 1);
            missile.x += missile.velocity.x;
            missile.y += missile.velocity.y;
            if (missile.x <= 0 || missile.y <= 0 || missile.x >= game.width || missile.y >= game.height) {
                missile.cleanUp();
            } else {
                cell = spatialHash[Math.floor(missile.x / 10)][Math.floor(missile.y / 10)];
                cell.push(missile);
                if (cell.length > 1) {
                    explosion(missile.x, missile.y);
                    for (var i = 0; i < cell.length; ++i) {
                        missile.cleanUp();
                    }
                    cell.length = 0;
                }
            }
            if (cb) cb(missile);
        }
    }

    var spawnEnemy = function () {
        var enemy = game.add.sprite(
            //Math.round(Math.random()) * game.width, Math.round(Math.random()) * game.height,
            400, 250,
            "enemy");
        enemy.shields = 5;
        enemy.anchor = new Phaser.Point(0.5, 0.5);
        enemy.animations.add("forward", [0, 1, 2, 3, 4], 10);
        enemy.animations.play("forward", null, true);
        enemy.velocity = new Phaser.Point(0, 0);
        enemies.push(enemy);
        enemy.cleanUp = function () {
            enemy.destroy();
            if (enemies.indexOf(enemy) === -1) return;
            enemies.splice(enemies.indexOf(enemy), 1);
        }
        var missileCd = 0;
        enemy.update = function () {
            if (missileCd == 0) {
                missileCd = 30;
                fire(enemy.x, enemy.y, enemy.rotation, function (missile) {
                    if (Phaser.Point.distance(missile, player) <= 16) {
                        hit(missile, player);
                    }
                }, "enemy");
            }
            missileCd--;   
            var totalFactor = 0;
            var totalCorrection = 0;

            var targetAngle = Math.atan2(player.y - enemy.y, player.x - enemy.x) + Math.PI / 2;
            var targetCorrection = Math.sign(angleDiff(targetAngle, enemy.rotation)) * 0.1;
            totalFactor += 1;
            totalCorrection += targetCorrection;

            var dodge = function (target) {
                targetAngle = Math.atan2(target.y - enemy.y, target.x - enemy.x) + Math.PI / 2;
                var dodgeTargetAngle = enemy.rotation - Math.sign(angleDiff(targetAngle, enemy.rotation)) * Math.PI / 2;
                var dodgeCorrection = Math.sign(angleDiff(dodgeTargetAngle, enemy.rotation)) * 0.07;
                var factor = Math.pow(100 / Phaser.Point.distance(target, enemy), 2);
                var enemyNormal = new Phaser.Point(Math.sin(enemy.rotation), -Math.cos(enemy.rotation));
                var targetNormal = new Phaser.Point(Math.sin(target.rotation), -Math.cos(target.rotation));
                factor *= Math.max(0, 1 - (enemyNormal.dot(targetNormal) + 1));
                dodgeCorrection *= factor;
                totalFactor += factor;
                totalCorrection += dodgeCorrection;
            }
            missiles.forEach(function (missile) {
                if (missile.tag === "enemy") return;
                dodge(missile);
            });
            dodge(player);

            totalCorrection /= totalFactor;

            enemy.rotation += totalCorrection || 0;
            enemy.velocity = new Phaser.Point(Math.sin(enemy.rotation) * 3, -Math.cos(enemy.rotation) * 3);
            enemy.x += enemy.velocity.x;
            enemy.y += enemy.velocity.y;
        }
    }

    var hit = function (missile, target) {
        if (target.shields) {
            target.shields--;
            if (target.shields === 0) {
                target.cleanUp();
            } else {
                Phaser.Point.add(
                    target.position,
                    Phaser.Point.subtract(target.position, missile.position).normalize().multiply(5, 5),
                    target.position
                );
            }
        }
        missile.cleanUp();

        explosion(missile.x, missile.y);

        var shield = game.add.sprite(target.x, target.y, "shield");
        shield.anchor = new Phaser.Point(0.5, 0.5);
        shield.animations.add("deflect", [0, 1, 2, 3], 20);
        shield.animations.play("deflect");
        shield.animations.currentAnim.killOnComplete = true;

        shield.rotation = Math.atan2(missile.y - target.y, missile.x - target.x) + Math.PI / 2;
        shield.update = function () {
            shield.x = target.x;
            shield.y = target.y;
        }
    }

    var explosion = function (x, y) {
        var explode = game.add.sprite(x, y, "explode");
        explode.animations.add("explode", [0, 1, 2, 3, 4, 5], 20);
        explode.animations.play("explode");
        explode.animations.currentAnim.killOnComplete = true;
        explode.anchor = new Phaser.Point(0.5, 0.5);
    }

    var angleDiff = function (angle1, angle2) {
        while (angle1 < 0) angle1 += Math.PI * 2;
        while (angle2 < 0) angle2 += Math.PI * 2;
        angle1 %= Math.PI * 2;
        angle2 %= Math.PI * 2;
        var diff = angle1 - angle2;
        if (diff > Math.PI) diff = -Math.PI * 2 + diff;
        else if (diff < -Math.PI) diff = diff + Math.PI * 2;
        return diff;
    }

    if (!Math.sign) Math.sign = function (x) { return x ? x / Math.abs(x) : 0 };

    var spatialHash = [];
    for (var i = 0; i < 80; ++i) {
        var column = [];
        for (var j = 0; j < 50; ++j) {
            column.push([]);
        }
        spatialHash.push(column);
    }

    game = new Phaser.Game(800, 500, Phaser.CANVAS, "platformer", { 
        preload: preload, 
        create: create,
        update: update
    });
}