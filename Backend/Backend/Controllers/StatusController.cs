using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers;

[ApiController]
[Route("[controller]")]
public class StatusController : ControllerBase
{
    private readonly ILogger<StatusController> _logger;

    public StatusController(ILogger<StatusController> logger)
    {
        _logger = logger;
    }

    [HttpPost("UpdatePlayerStatus")]
    public IActionResult UpdatePlayerStatus(object timestamp)
    {
        _logger.LogInformation("", timestamp);

        return Ok();
    }

}
