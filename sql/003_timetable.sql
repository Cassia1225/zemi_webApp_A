BEGIN;

-- 授業がまだない年度も登録できる。年度は4月に始まる年の西暦。
CREATE TABLE IF NOT EXISTS timetable_years (
    user_id       bigint   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    academic_year smallint NOT NULL CHECK (academic_year BETWEEN 2000 AND 2100),
    PRIMARY KEY (user_id, academic_year)
);

CREATE TABLE IF NOT EXISTS teachers (
    user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    id      bigint GENERATED ALWAYS AS IDENTITY,
    name    text   NOT NULL CHECK (name ~ '[^[:space:]]'),
    PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS classrooms (
    user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    id      bigint GENERATED ALWAYS AS IDENTITY,
    name    text   NOT NULL CHECK (name ~ '[^[:space:]]'),
    PRIMARY KEY (user_id, id)
);

-- 1行は1コマ。まとめて登録するコマには、同じ series_id を明示して保存する。
CREATE TABLE IF NOT EXISTS courses (
    id            bigint   GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id       bigint   NOT NULL,
    academic_year smallint NOT NULL,
    quarter       smallint NOT NULL CHECK (quarter BETWEEN 1 AND 4),
    day_of_week   smallint NOT NULL CHECK (day_of_week BETWEEN 1 AND 6), -- 月=1、土=6
    period        smallint NOT NULL CHECK (period BETWEEN 1 AND 6),
    series_id     uuid     NOT NULL DEFAULT gen_random_uuid(),
    subject_name  text     NOT NULL CHECK (subject_name ~ '[^[:space:]]'),
    teacher_id    bigint,
    classroom_id  bigint,
    color         text     NOT NULL DEFAULT '#AFD9F5' CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
    memo          text     NOT NULL DEFAULT '',
    CONSTRAINT courses_unique_slot UNIQUE (user_id, academic_year, quarter, day_of_week, period),
    FOREIGN KEY (user_id, academic_year) REFERENCES timetable_years (user_id, academic_year)
        ON DELETE CASCADE,
    -- 候補を削除しても、授業と所有者は残し、その候補だけを未設定にする。
    FOREIGN KEY (user_id, teacher_id) REFERENCES teachers (user_id, id)
        ON DELETE SET NULL (teacher_id),
    FOREIGN KEY (user_id, classroom_id) REFERENCES classrooms (user_id, id)
        ON DELETE SET NULL (classroom_id)
);

CREATE INDEX IF NOT EXISTS courses_series_idx ON courses (user_id, academic_year, series_id);

COMMIT;
