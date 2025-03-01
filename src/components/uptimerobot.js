import ReactTooltip from 'react-tooltip';
import { useEffect, useState, useContext } from 'react';
import { GetMonitors } from '../common/uptimerobot';
import { formatDuration, formatNumber } from '../common/helper';
import Link from './link';
import { MonitorContext } from './app';

function UptimeRobot({ apikey }) {
  const status = {
    ok: '正常运行',
    down: '访问异常',
    unknow: '暂停检测'
  };

  const { CountDays, ShowLink } = window.Config;

  const [monitors, setMonitors] = useState([]);
  const [sslInfo, setSslInfo] = useState({});

  const { totalSites, setTotalSites, upSites, setUpSites, downSites, setDownSites, unknownSites, setUnknownSites, searchTerm } = useContext(MonitorContext);

  useEffect(() => {
    GetMonitors(apikey, CountDays).then((data) => {
      setMonitors(data);

      let up = data.filter((monitor) => monitor.status === 'ok').length;
      let down = data.filter((monitor) => monitor.status === 'down').length;
      let unknow = data.filter((monitor) => monitor.status === 'unknow').length;

      setTotalSites(prevTotal => prevTotal + data.length);
      setUpSites(prevUp => prevUp + up);
      setDownSites(prevDown => prevDown + down);
      setUnknownSites(prevUnknown => prevUnknown + unknow);

      const today = new Date().toISOString().split('T')[0]; // 获取当天日期字符串

      data.forEach((site) => {
        const url = new URL(site.url);
        const domain = url.hostname;

        const cachedSslInfo = JSON.parse(localStorage.getItem(domain));
        
        if (cachedSslInfo && cachedSslInfo.cachedDate === today) {
          setSslInfo(prevState => ({
            ...prevState,
            [domain]: cachedSslInfo.data
          }));
        } else {
          fetch(`https://api.jmjm.tk/api/sslinfo/?url=${domain}`)
            .then(response => response.json())
            .then(info => {
              if (info.code === 200) {
                const sslData = info.data;
                localStorage.setItem(domain, JSON.stringify({ data: sslData, cachedDate: today }));
                setSslInfo(prevState => ({
                  ...prevState,
                  [domain]: sslData
                }));
              }
            })
            .catch(error => {
              console.error(`获取 ${domain} 的 SSL 信息时出错:`, error);
            });
        }
      });
    }).catch(error => {
      console.error('获取监控信息时出错:', error);
    });
  }, [apikey, CountDays, setTotalSites, setUpSites, setDownSites, setUnknownSites]);

  if (monitors.length === 0) {
    return (
      <div className='site'>
        <div className='loading' />
      </div>
    );
  }

  const filteredMonitors = monitors.filter((site) => {
    if (!searchTerm) return true;
    const regex = new RegExp(searchTerm, 'i');
    return regex.test(site.name);
  });

  if (filteredMonitors.length === 0) {
    return (
      <div className='site'>
        <div className='no-results'>没有找到相关网站</div>
      </div>
    );
  }

  return filteredMonitors.map((site) => {
    const url = new URL(site.url);
    const domain = url.hostname;
    const ssl = sslInfo[domain] || {};

    return (
      <div key={site.id} className='site'>
        <div className='meta'>
          <span className='name' dangerouslySetInnerHTML={{ __html: site.name }} />
          {ShowLink && (
            <>
              <Link to={site.url} text="Link" className='link' />
              <span
                className='ssl-info'
                data-tip={
                  ssl.valid_to
                    ? `到期时间: ${ssl.valid_to}，剩余天数: ${ssl.remaining_days}天`
                    : '暂无证书'
                }
                data-for={`tooltip-${site.id}`}
                id={`ssl-info-${site.id}`}
                onClick={() => {
                  const tooltip = document.getElementById(`ssl-info-${site.id}`);
                  ReactTooltip.show(tooltip);
                }}
              >
                SSL
              </span>
              <ReactTooltip id={`tooltip-${site.id}`} place='top' type='dark' effect='solid' className='tooltip' />
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
