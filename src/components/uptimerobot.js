import ReactTooltip from 'react-tooltip';
import { useEffect, useState, useContext } from 'react';
import { GetMonitors } from '../common/uptimerobot';
import { formatDuration, formatNumber } from '../common/helper';
import Link from './link';
import { MonitorContext } from './app';

function UptimeRobot({ apikey }) {
  const status = {
    ok: '正常运行',
    down: '无法访问',
    unknow: '未知状态'
  };

  const { CountDays, ShowLink } = window.Config;

  const [monitors, setMonitors] = useState([]);
  const [sslInfo, setSslInfo] = useState({});

  const { totalSites, setTotalSites, upSites, setUpSites, downSites, setDownSites } = useContext(MonitorContext);

  useEffect(() => {
    GetMonitors(apikey, CountDays).then((data) => {
      setMonitors(data);

      let up = data.filter((monitor) => monitor.status === 'ok').length;
      let down = data.filter((monitor) => monitor.status === 'down').length;

      setTotalSites(prevTotal => prevTotal + data.length);
      setUpSites(prevUp => prevUp + up);
      setDownSites(prevDown => prevDown + down);

      const domains = data.map((site) => {
        const url = new URL(site.url);
        return url.hostname;  // 仅提取域名部分
      });

      console.log('Domains to check:', domains);

      fetch('/ssl-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ domains })
      }).then(response => response.json())
        .then(info => {
          console.log('SSL info received:', info);
          const sslData = {};
          info.forEach(item => {
            sslData[item.domain] = item;
          });
          setSslInfo(sslData);
        }).catch(error => {
          console.error('Error fetching SSL info:', error);
        });
    }).catch(error => {
      console.error('Error fetching monitors:', error);
    });
  }, [apikey, CountDays, setTotalSites, setUpSites, setDownSites]);

  if (monitors.length === 0) {
    return (
      <div className='site'>
        <div className='loading' />
      </div>
    );
  }

  return monitors.map((site) => {
    const url = new URL(site.url);
    const domain = url.hostname;
    const ssl = sslInfo[domain] || {};

    console.log(`SSL info for ${domain}:`, ssl);

    return (
      <div key={site.id} className='site'>
        <div className='meta'>
          <span className='name' dangerouslySetInnerHTML={{ __html: site.name }} />
          {ShowLink && (
            <>
              <Link className='link' to={site.url} text={site.name} />
              {ssl.daysRemaining !== undefined ? (
                <span className='ssl-info' data-tip={`到期时间: ${ssl.validTo}`} onClick={() => alert(`到期时间: ${ssl.validTo}`)}>
                  (剩余天数: {ssl.daysRemaining})
                </span>
              ) : (
                <span className='ssl-info'>(无证书)</span>
              )}
            </>
          )}
          <div className='status-container'>
            <span className={'status-indicator ' + site.status}></span>
            <span className={'status ' + site.status}>{status[site.status]}</span>
          </div>
        </div>
        <div className='timeline'>
          {site.daily.map((data, index) => {
            let status = '';
            let text = data.date.format('YYYY-MM-DD ');
            if (data.uptime >= 100) {
              status = 'ok';
              text += `可用率 ${formatNumber(data.uptime)}%`;
            } else if (data.uptime <= 0 && data.down.times === 0) {
              status = 'none';
              text += '无数据';
            } else {
              status = 'down';
              text += `故障 ${data.down.times} 次，累计 ${formatDuration(data.down.duration)}，可用率 ${formatNumber(data.uptime)}%`;
            }
            return (<i key={index} className={status} data-tip={text} />)
          })}
        </div>
        <div className='summary'>
          <span>今天</span>
          <span>
            {site.total.times
              ? `最近 ${CountDays} 天故障 ${site.total.times} 次，累计 ${formatDuration(site.total.duration)}，平均可用率 ${site.average}%`
              : `最近 ${CountDays} 天可用率 ${site.average}%`}
          </span>

<span>{site.daily[site.daily.length - 1].date.format('YYYY-MM-DD')}</span>
        </div>
        <ReactTooltip className='tooltip' place='top' type='dark' effect='solid' />
      </div>
    );
  });
}

export default UptimeRobot;