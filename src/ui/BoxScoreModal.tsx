// 战报：单场双方 Box Score
import { useState } from 'react';
import type { GameResult, LeagueState } from '../engine/types';
import { POS_CN } from './format';

export function BoxScoreModal({ l, game, title, onClose }: {
  l: LeagueState; game: GameResult; title: string; onClose: () => void;
}) {
  const away = l.teams[game.awayId];
  const home = l.teams[game.homeId];
  const awayWin = game.awayScore > game.homeScore;
  const [side, setSide] = useState<0 | 1>(awayWin ? 0 : 1);

  const sideMeta = [
    { team: away, lines: game.awayBox ?? [], score: game.awayScore, win: awayWin },
    { team: home, lines: game.homeBox ?? [], score: game.homeScore, win: !awayWin },
  ];

  const meta = sideMeta[side];
  const rows = meta.lines
    .filter((b) => b.min > 0 || b.fga > 0)
    .sort((a, b) => b.min - a.min)
    .map((b) => {
      const p = meta.team.players.find((pl) => pl.id === b.pid);
      return { b, p };
    });

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal box-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="box-title">
            <div className="box-score">
              <span className={`big ${game.awayScore > game.homeScore ? 'win' : ''}`}>{game.awayScore}</span>
              <span className="vs">{away.abbr}  VS  {home.abbr}</span>
              <span className={`big ${game.homeScore > game.awayScore ? 'win' : ''}`}>{game.homeScore}</span>
            </div>
            <div className="box-sub">{title}</div>
          </div>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="side-tabs">
          {sideMeta.map((m, i) => (
            <button
              key={i}
              className={`side-tab ${side === i ? 'on' : ''}`}
              onClick={() => setSide(i as 0 | 1)}
            >
              {m.team.abbr} {m.score} <span className="side-name">{m.team.name}</span>
            </button>
          ))}
        </div>
        <div className="table-wrap">
          <table className="tbl box-tbl">
            <thead>
              <tr>
                <th>球员</th><th>位置</th>
                <th className="num">分钟</th><th className="num">得分</th><th className="num">篮板</th><th className="num">助攻</th>
                <th className="num">抢断</th><th className="num">盖帽</th><th className="num">失误</th><th className="num">犯规</th>
                <th className="num">投篮</th><th className="num">三分</th><th className="num">罚球</th><th className="num">+/−</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ b, p }) => (
                <tr key={b.pid}>
                  <td className="pl">{p?.name ?? '#' + b.pid}</td>
                  <td>{p ? POS_CN[p.pos] : '-'}</td>
                  <td>{b.min}</td>
                  <td className="num hot">{b.pts}</td>
                  <td className="num">{b.reb}</td>
                  <td className="num">{b.ast}</td>
                  <td className="num">{b.stl}</td>
                  <td className="num">{b.blk}</td>
                  <td className="num">{b.tov}</td>
                  <td className="num">{b.pf}</td>
                  <td className="num">{b.fgm}-{b.fga}</td>
                  <td className="num">{b.tpm}-{b.tpa}</td>
                  <td className="num">{b.ftm}-{b.fta}</td>
                  <td className="num">{b.pm > 0 ? '+' : ''}{b.pm}</td>
                </tr>
              ))}
            </tbody>
            {/* v2.5.0：末行加"总计"（全队合计） */}
            <tfoot>
              {(() => {
                const sum = (f: (b: typeof rows[number]['b']) => number) => rows.reduce((s, r) => s + f(r.b), 0);
                const s = {
                  min: sum((b) => b.min), pts: sum((b) => b.pts), reb: sum((b) => b.reb), ast: sum((b) => b.ast),
                  stl: sum((b) => b.stl), blk: sum((b) => b.blk), tov: sum((b) => b.tov), pf: sum((b) => b.pf),
                  fgm: sum((b) => b.fgm), fga: sum((b) => b.fga),
                  tpm: sum((b) => b.tpm), tpa: sum((b) => b.tpa),
                  ftm: sum((b) => b.ftm), fta: sum((b) => b.fta),
                };
                return (
                  <tr className="box-total-row">
                    <td className="pl">总计</td>
                    <td>—</td>
                    <td>{s.min}</td>
                    <td className="num">{s.pts}</td>
                    <td className="num">{s.reb}</td>
                    <td className="num">{s.ast}</td>
                    <td className="num">{s.stl}</td>
                    <td className="num">{s.blk}</td>
                    <td className="num">{s.tov}</td>
                    <td className="num">{s.pf}</td>
                    <td className="num">{s.fgm}-{s.fga}</td>
                    <td className="num">{s.tpm}-{s.tpa}</td>
                    <td className="num">{s.ftm}-{s.fta}</td>
                    <td className="num">—</td>
                  </tr>
                );
              })()}
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
